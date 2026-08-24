import { AccessToken } from "livekit-server-sdk";
import { env } from "../../config/env";
import { SessionRole } from "../../middlewares/session-auth";

export function isLiveKitConfigured(): boolean {
  return Boolean(env.livekitApiKey && env.livekitApiSecret && env.livekitUrl);
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
