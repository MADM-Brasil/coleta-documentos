import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { env } from "../../config/env";
import { SessionRole } from "../../middlewares/session-auth";

export function isLiveKitConfigured(): boolean {
  return Boolean(env.livekitApiKey && env.livekitApiSecret && env.livekitUrl);
}

// Fecha a sala no servidor do LiveKit e desconecta à força qualquer participante que
// ainda esteja nela — usado ao excluir/cancelar uma coleta, pra garantir que nenhuma
// conexão fique "presa" consumindo minutos do plano por engano (aba esquecida aberta etc.).
export async function closeLiveKitRoom(collectionId: string): Promise<void> {
  if (!isLiveKitConfigured()) return;
  const client = new RoomServiceClient(env.livekitUrl!, env.livekitApiKey!, env.livekitApiSecret!);
  try {
    await client.deleteRoom(roomNameFor(collectionId));
  } catch {
    // Sala pode já não existir (ninguém entrou ainda) — não é erro de verdade.
  }
}

export function roomNameFor(collectionId: string): string {
  return `collection-${collectionId}`;
}

// Cliente pode publicar/assinar vídeo e áudio, mas nada além disso é concedido aqui —
// permissões de negócio (aprovar documento etc.) são decididas pelas próprias rotas
// da API, nunca pelo token de sala do LiveKit.
export async function createLiveKitToken(params: {
  collectionId: string;
  role: SessionRole;
  identity: string;
  name: string;
}): Promise<string> {
  const { collectionId, role, identity, name } = params;
  const at = new AccessToken(env.livekitApiKey!, env.livekitApiSecret!, {
    identity,
    name,
    metadata: JSON.stringify({ role }),
  });
  at.addGrant({
    room: roomNameFor(collectionId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}
