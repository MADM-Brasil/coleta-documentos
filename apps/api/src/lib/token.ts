import crypto from "node:crypto";

export function generateCollectionToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateStorageKey(originalFilename: string): string {
  const ext = originalFilename.includes(".") ? originalFilename.split(".").pop() : "";
  const id = crypto.randomUUID();
  return ext ? `${id}.${ext}` : id;
}

// Nome descritivo (ex: "RG_19151475_1706450000000.png") para o arquivo já sair do
// upload com um nome reconhecível no storage (Cloudinary etc.), permitindo que
// automações (Make) filtrem/identifiquem o tipo de documento pelo próprio nome.
export function generateDescriptiveStorageKey(
  tipo: string,
  leadId: string | null,
  originalFilename: string
): string {
  const ext = originalFilename.includes(".") ? originalFilename.split(".").pop() : "";
  const safeTipo = tipo.replace(/[^a-zA-Z0-9]/g, "");
  const safeLeadId = (leadId ?? "sem-lead").replace(/[^a-zA-Z0-9]/g, "");
  const uniquePart = Date.now();
  const base = `${safeTipo}_${safeLeadId}_${uniquePart}`;
  return ext ? `${base}.${ext}` : base;
}
