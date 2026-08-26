import { prisma } from "../../lib/prisma";

// Acima disso não embutimos o arquivo no corpo do webhook (payload ficaria grande
// demais / arriscado de estourar limite do Make) — o Make cai no fallback de
// buscar pelo "link" via HTTP GET nesses casos (vídeos, por exemplo).
const MAX_EMBED_BYTES = 10 * 1024 * 1024;

// tipo: "RG" | "COMPROVANTE" | "AUDIO" | "VIDEO" (por documento) | "CONCLUIDO" (coleta finalizada)
export interface CallbackPayload {
  tipo: string;
  // Número quando o externalId é numérico (ex: ID de lead da Kommo) — APIs de CRM
  // costumam validar o tipo do campo, e mandar como texto ("123") pode ser rejeitado.
  leadId: string | number | null;
  link: string;
  // Public ID exato no Cloudinary (ex: "forms-madm/RG_19151475_123") — usar no
  // módulo "Get a Resource" do Cloudinary no Make, junto com resourceType.
  publicId?: string;
  resourceType?: "image" | "video" | "raw";
  // Arquivo já embutido em base64 — permite ao Make anexar direto na Kommo sem
  // precisar buscar depois (evita depender do servidor estar acordado/o arquivo
  // ainda existir num plano sem disco persistente). Ausente para arquivos grandes.
  arquivoBase64?: string;
  mimeType?: string;
  nomeArquivo?: string;
}

interface FileInfo {
  // Ausente pra arquivos grandes (ex: vídeo) — nesse caso o Make busca pelo "link"
  // via HTTP, mas ainda manda mimeType/nomeArquivo pra ele nomear o arquivo direito.
  buffer?: Buffer;
  mimeType: string;
  filename: string;
  publicId?: string;
}

function resourceTypeFor(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  return "raw";
}

// Notifica o Make/Kommo em tempo real quando algo acontece na coleta
// (documento enviado, coleta concluída). Nunca deve travar o fluxo do cliente:
// falha de rede aqui é apenas registrada, o upload já foi confirmado antes disso.
export async function notifyCallback(
  collectionRequestId: string,
  tipo: string,
  link: string,
  fileInfo?: FileInfo
) {
  const collection = await prisma.collectionRequest.findUnique({
    where: { id: collectionRequestId },
    include: { client: true },
  });
  if (!collection?.callbackUrl) return;

  const externalId = collection.client.externalId;
  const leadId = externalId && /^\d+$/.test(externalId) ? Number(externalId) : externalId;

  const payload: CallbackPayload = { tipo, leadId, link };

  if (fileInfo) {
    if (fileInfo.publicId) {
      payload.publicId = fileInfo.publicId;
      payload.resourceType = resourceTypeFor(fileInfo.mimeType);
    }
    // mimeType/nomeArquivo sempre vão junto (mesmo sem o arquivo embutido) — é o
    // que o Make usa pra nomear o arquivo certo (com extensão) ao baixar pelo "link".
    payload.mimeType = fileInfo.mimeType;
    payload.nomeArquivo = fileInfo.filename;
    if (fileInfo.buffer && fileInfo.buffer.length <= MAX_EMBED_BYTES) {
      payload.arquivoBase64 = fileInfo.buffer.toString("base64");
    }
  }

  try {
    const response = await fetch(collection.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`[callback] ${collection.callbackUrl} respondeu ${response.status} para o tipo ${tipo}`);
    }
  } catch (err) {
    console.error(`[callback] falha ao notificar ${collection.callbackUrl} (tipo ${tipo}):`, err);
  }
}
