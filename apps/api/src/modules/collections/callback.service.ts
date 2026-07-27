import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

export interface CallbackPayload {
  event: string;
  collectionId: string;
  externalId: string | null;
  clientName: string;
  status: string;
  item?: {
    id: string;
    type: string;
    title: string;
    status: string;
    mediaId: string;
    downloadUrl: string;
    mimeType: string;
    filename: string;
  };
  timestamp: string;
}

interface ItemInfo {
  id: string;
  type: string;
  title: string;
  status: string;
  mediaId: string;
  mimeType: string;
  filename: string;
}

// Notifica o Make/Kommo em tempo real quando algo acontece na coleta
// (documento enviado, coleta concluída). Nunca deve travar o fluxo do cliente:
// falha de rede aqui é apenas registrada, o upload já foi confirmado antes disso.
export async function notifyCallback(collectionRequestId: string, event: string, itemInfo?: ItemInfo) {
  const collection = await prisma.collectionRequest.findUnique({
    where: { id: collectionRequestId },
    include: { client: true },
  });
  if (!collection?.callbackUrl) return;

  const payload: CallbackPayload = {
    event,
    collectionId: collection.id,
    externalId: collection.client.externalId,
    clientName: collection.client.name,
    status: collection.status,
    item: itemInfo
      ? {
          id: itemInfo.id,
          type: itemInfo.type,
          title: itemInfo.title,
          status: itemInfo.status,
          mediaId: itemInfo.mediaId,
          downloadUrl: `${env.appUrl}/webhook/media/${itemInfo.mediaId}`,
          mimeType: itemInfo.mimeType,
          filename: itemInfo.filename,
        }
      : undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(collection.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`[callback] ${collection.callbackUrl} respondeu ${response.status} para o evento ${event}`);
    }
  } catch (err) {
    console.error(`[callback] falha ao notificar ${collection.callbackUrl} (evento ${event}):`, err);
  }
}
