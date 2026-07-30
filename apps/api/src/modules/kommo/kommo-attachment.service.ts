import { env } from "../../config/env";

// Implementa o fluxo documentado pela Kommo para anexo nativo de arquivo em um lead:
// https://developers.kommo.com/reference/files-api-key-features
// 1) obter o "drive" da conta -> 2) abrir sessão de upload -> 3) enviar o arquivo
// -> 4) criar uma nota do tipo "attachment" referenciando o uuid do arquivo.
//
// Só é ativado quando KOMMO_SUBDOMAIN e KOMMO_API_TOKEN estão configurados — sem
// isso, attachFileToKommoLead() não faz nada (o fluxo por link continua funcionando).

interface UploadSession {
  session_id: number;
  upload_url: string;
  max_file_size: number;
  max_part_size: number;
}

interface UploadedFile {
  uuid: string;
  name: string;
  size: number;
}

let cachedDriveUrl: string | null = null;

function authHeaders(json = true) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env.kommoApiToken}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function getDriveUrl(): Promise<string> {
  if (cachedDriveUrl) return cachedDriveUrl;

  const res = await fetch(`https://${env.kommoSubdomain}.kommo.com/api/v4/account?with=drive_url`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(`Falha ao obter drive_url da Kommo (HTTP ${res.status})`);
  const data = (await res.json()) as { drive_url?: string };
  if (!data.drive_url) throw new Error("Resposta da Kommo não trouxe drive_url.");

  cachedDriveUrl = data.drive_url;
  return cachedDriveUrl;
}

async function openUploadSession(driveUrl: string, fileSize: number, mimeType: string, filename: string) {
  const res = await fetch(`${driveUrl}/v4/files/upload/session`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ file_name: filename, file_size: fileSize, file_type: mimeType }),
  });
  if (!res.ok) throw new Error(`Falha ao abrir sessão de upload na Kommo (HTTP ${res.status})`);
  return (await res.json()) as UploadSession;
}

async function uploadFilePart(uploadUrl: string, buffer: Buffer, filename: string, mimeType: string) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Falha ao enviar arquivo para a Kommo (HTTP ${res.status})`);
  return (await res.json()) as UploadedFile;
}

async function createAttachmentNote(leadId: number, fileUuid: string, fileName: string) {
  const res = await fetch(`https://${env.kommoSubdomain}.kommo.com/api/v4/leads/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify([
      { entity_id: leadId, note_type: "attachment", params: { file_uuid: fileUuid, file_name: fileName } },
    ]),
  });
  if (!res.ok) throw new Error(`Falha ao criar nota de anexo na Kommo (HTTP ${res.status})`);
}

export function isKommoAttachmentConfigured(): boolean {
  return Boolean(env.kommoSubdomain && env.kommoApiToken);
}

// Nunca lança erro para quem chama — falhas aqui só ficam no log, o upload do
// cliente já foi confirmado antes disso e não deve ser afetado.
export async function attachFileToKommoLead(
  leadId: string | number | null,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<void> {
  if (!isKommoAttachmentConfigured() || !leadId) return;

  const numericLeadId = typeof leadId === "string" ? Number(leadId) : leadId;
  if (!numericLeadId || Number.isNaN(numericLeadId)) return;

  try {
    const driveUrl = await getDriveUrl();
    const session = await openUploadSession(driveUrl, buffer.length, mimeType, filename);
    const uploaded = await uploadFilePart(session.upload_url, buffer, filename, mimeType);
    await createAttachmentNote(numericLeadId, uploaded.uuid, filename);
  } catch (err) {
    console.error(`[kommo-attachment] falha ao anexar arquivo no lead ${numericLeadId}:`, err);
  }
}
