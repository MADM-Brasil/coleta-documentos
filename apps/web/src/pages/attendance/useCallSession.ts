import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Room, RoomEvent, RemoteTrack, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { videoApi, realtimeUrl } from "../../lib/videoApi";
import { getAgentSession } from "../../lib/agentAuth";
import type { CallState, Role } from "./types";

interface UseCallSessionParams {
  collectionId: string;
  role: Role;
  // Só o CLIENT usa token (vem da URL). O AGENT autentica via sessão do painel
  // (header Authorization, anexado automaticamente pelo videoApi).
  token?: string;
}

export function useCallSession({ collectionId, token, role }: UseCallSessionParams) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [peerConnected, setPeerConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  // true só depois que o vídeo do OUTRO participante é de fato recebido — evita mostrar
  // uma tela preta "muda" quando a chamada já está "active" mas o outro lado ainda não
  // publicou a câmera (permissão lenta, rede ruim etc.).
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const livekitCredsRef = useRef<{ url: string; jwt: string } | null>(null);

  useEffect(() => {
    if (!collectionId) return;
    if (role === "CLIENT" && !token) return;
    let cancelled = false;

    videoApi
      .post(`/${collectionId}/token`, token ? { token } : {})
      .then(({ data }) => {
        if (cancelled) return;
        livekitCredsRef.current = { url: data.livekitUrl, jwt: data.livekitToken };
        setClientName(data.collection?.clientName ?? "");
      })
      .catch(() => {
        if (!cancelled) setConnectionError("Não foi possível preparar a videochamada.");
      });

    const socket = io(realtimeUrl, {
      path: "/realtime",
      query:
        role === "AGENT"
          ? { collectionId, agentSession: getAgentSession() ?? "" }
          : { collectionId, token: token ?? "" },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setCallState((s) => (s === "idle" ? "waiting_peer" : s)));
    socket.on("connect_error", () => setConnectionError("Não foi possível conectar à sala de atendimento."));

    socket.on("client_joined", () => role === "AGENT" && setPeerConnected(true));
    socket.on("client_left", () => role === "AGENT" && setPeerConnected(false));
    socket.on("agent_joined", () => role === "CLIENT" && setPeerConnected(true));
    socket.on("agent_left", () => role === "CLIENT" && setPeerConnected(false));

    socket.on("call_incoming", () => setCallState((s) => (s === "active" ? s : "incoming")));
    socket.on("call_accepted", () => connectLiveKit());
    socket.on("call_ended", () => disconnectLiveKit());

    return () => {
      cancelled = true;
      socket.disconnect();
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, token, role]);

  const connectLiveKit = useCallback(async () => {
    // Evita reconectar (e perder os tracks já anexados) se um segundo "call_accepted"
    // chegar enquanto já estamos conectados/conectando — pode acontecer se o socket
    // reconectar sozinho (rede instável) e o servidor reemitir o evento.
    if (roomRef.current) return;
    setCallState("connecting");
    setMediaError(null);
    try {
      if (!livekitCredsRef.current) {
        const { data } = await videoApi.post(`/${collectionId}/token`, token ? { token } : {});
        livekitCredsRef.current = { url: data.livekitUrl, jwt: data.livekitToken };
      }
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
          setRemoteVideoActive(true);
        }
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) setRemoteVideoActive(false);
      });
      room.on(RoomEvent.Disconnected, () => {
        setRemoteVideoActive(false);
        setCallState("ended");
      });

      await room.connect(livekitCredsRef.current.url, livekitCredsRef.current.jwt);
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      const camPub = room.localParticipant.videoTrackPublications.values().next().value;
      if (camPub?.track && localVideoRef.current) camPub.track.attach(localVideoRef.current);

      setCallState("active");
    } catch (err) {
      console.error(err);
      roomRef.current?.disconnect();
      roomRef.current = null;
      setMediaError(
        "Não conseguimos acessar sua câmera ou microfone. Verifique as permissões do navegador e tente novamente."
      );
      setCallState("incoming");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, token]);

  function disconnectLiveKit() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRemoteVideoActive(false);
    setCallState("ended");
  }

  function acceptCall() {
    socketRef.current?.emit("call_accept");
  }

  function endCall() {
    socketRef.current?.emit("call_end");
    disconnectLiveKit();
  }

  function toggleMic() {
    const next = !micEnabled;
    roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }

  function toggleCam() {
    const next = !camEnabled;
    roomRef.current?.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
  }

  return {
    callState,
    peerConnected,
    micEnabled,
    camEnabled,
    mediaError,
    connectionError,
    clientName,
    remoteVideoActive,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    acceptCall,
    endCall,
    toggleMic,
    toggleCam,
  };
}
