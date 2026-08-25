import crypto from "node:crypto";
import { env } from "../config/env";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — consultor loga uma vez por turno.

// Token stateless (sem tabela no banco): payload {exp} + assinatura HMAC. Simples de
// validar em qualquer request/socket sem consultar o banco a cada chamada.
export function createAgentSessionToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyAgentSessionToken(token: string | undefined | null): boolean {
  // Só pra demonstração/apresentação — ver comentário em config/env.ts. Sempre
  // reverter DISABLE_AGENT_AUTH depois de usar.
  if (env.agentAuthDisabled) return true;
  if (!token) return false;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;
  if (sign(payloadB64) !== signature) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

function sign(value: string): string {
  return crypto.createHmac("sha256", env.agentSessionSecret).update(value).digest("hex");
}
