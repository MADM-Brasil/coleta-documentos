import crypto from "node:crypto";

export function generateCollectionToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/l) — pro consultor conseguir
// ditar/digitar o código curto sem confusão.
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

// Código curto (8 chars) usado só como atalho de redirecionamento pro link
// completo do cliente — não substitui o token real, que continua sendo o que
// autentica as rotas.
export function generateShortCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return code;
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
