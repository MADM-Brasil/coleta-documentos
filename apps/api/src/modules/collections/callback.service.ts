import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

// tipo: "RG" | "COMPROVANTE" | "AUDIO" | "VIDEO" (por documento) | "CONCLUIDO" (coleta finalizada)
export interface CallbackPayload {
  tipo: string;
  leadId: string | null;
  link: string;
}

// Notifica o Make/Kommo em tempo real quando algo acontece na coleta
// (documento enviado, coleta concluída). Nunca deve travar o fluxo do cliente:
// falha de rede aqui é apenas registrada, o upload já foi confirmado antes disso.
export async function notifyCallback(collectionRequestId: string, tipo: string, link: string) {
  const collection = await prisma.collectionRequest.findUnique({
    where: { id: collectionRequestId },
    include: { client: true },
  });
  if (!collection?.callbackUrl) return;

  const payload: CallbackPayload = {
    tipo,
    leadId: collection.client.externalId,
    link,
  };

  try {
    const response = await fetch(collection.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`[callback] ${collection.callbackUrl} respondeu ${response.status} para o tipo ${tipo}`);
    }
  } catch (err) {
    console.error(`[callback] falha ao notificar ${collection.callbackUrl} (tipo ${tipo}):`, err);
  }
}
