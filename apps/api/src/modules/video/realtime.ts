import http from "node:http";
import { Server, Socket } from "socket.io";
import { env } from "../../config/env";
import { resolveSessionToken, SessionRole } from "../../middlewares/session-auth";
import { verifyAgentSessionToken } from "../../lib/agent-session";

// Camada nova, isolada: não substitui nem interfere no webhook do Make (callback.service.ts).
// Serve apenas para sincronizar em tempo real o que acontece na sala de atendimento
// (chamada de vídeo + acompanhamento de documentos) entre o navegador do cliente e o do consultor.
export type RealtimeEvent =
  | "client_joined"
  | "client_left"
  | "agent_joined"
  | "agent_left"
  | "call_incoming"
  | "call_accepted"
  | "call_declined"
  | "call_ended"
  | "document_uploaded"
  | "document_approved"
  | "document_rejected"
  | "collection_completed"
  | "media_capture_start"
  | "media_capture_cancel";

let io: Server | null = null;

interface SocketData {
  collectionId: string;
  role: SessionRole;
}

export function initRealtime(httpServer: http.Server) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
    path: "/realtime",
  });

  io.use(async (socket, next) => {
    const { collectionId, token, agentSession } = socket.handshake.query as {
      collectionId?: string;
      token?: string;
      agentSession?: string;
    };
    if (agentSession) {
      if (!verifyAgentSessionToken(agentSession) || !collectionId) return next(new Error("unauthorized"));
      (socket.data as SocketData) = { collectionId, role: "AGENT" };
      return next();
    }
    const resolved = await resolveSessionToken(collectionId, token);
    if (!resolved) return next(new Error("unauthorized"));
    (socket.data as SocketData) = resolved;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const { collectionId, role } = socket.data as SocketData;
    const room = collectionId;
    socket.join(room);

    socket.to(room).emit(role === "AGENT" ? "agent_joined" : "client_joined");
    if (role === "AGENT") {
      // Se o cliente já estiver na sala, o consultor precisa saber para poder "atender".
      const clientAlreadyPresent = [...(io!.sockets.adapter.rooms.get(room) ?? [])].some((sid) => {
        const s = io!.sockets.sockets.get(sid);
        return s && (s.data as SocketData).role === "CLIENT";
      });
      if (clientAlreadyPresent) socket.emit("call_incoming");
    } else {
      const agentAlreadyPresent = [...(io!.sockets.adapter.rooms.get(room) ?? [])].some((sid) => {
        const s = io!.sockets.sockets.get(sid);
        return s && (s.data as SocketData).role === "AGENT";
      });
      if (agentAlreadyPresent) socket.to(room).emit("call_incoming");
    }

    // Consultor "atende" a chamada — só então os dois lados conectam de fato ao LiveKit.
    socket.on("call_accept", () => {
      if (role !== "AGENT") return;
      io!.to(room).emit("call_accepted");
    });

    // Consultor recusa a chamada — o cliente volta a esperar (sem cair na chamada
    // nem receber acesso de vídeo nenhum, já que o LiveKit só conecta após "call_accept").
    socket.on("call_decline", () => {
      if (role !== "AGENT") return;
      io!.to(room).emit("call_declined");
    });

    socket.on("call_end", () => {
      io!.to(room).emit("call_ended");
    });

    // Consultor avisa o cliente que está gravando o áudio/vídeo dele direto da chamada
    // (o cliente só vê um status "em andamento", sem controles próprios nesse item).
    socket.on("media_capture_start", (payload: { itemId: string }) => {
      if (role !== "AGENT") return;
      io!.to(room).emit("media_capture_start", payload);
    });
    socket.on("media_capture_cancel", (payload: { itemId: string }) => {
      if (role !== "AGENT") return;
      io!.to(room).emit("media_capture_cancel", payload);
    });

    socket.on("disconnect", () => {
      socket.to(room).emit(role === "AGENT" ? "agent_left" : "client_left");
    });
  });

  return io;
}

export function emitToRoom(collectionId: string, event: RealtimeEvent, payload?: unknown) {
  io?.to(collectionId).emit(event, payload);
}
