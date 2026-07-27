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
