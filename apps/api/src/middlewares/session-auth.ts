import { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/token";
import { verifyAgentSessionToken } from "../lib/agent-session";

export type SessionRole = "CLIENT" | "AGENT";

declare global {
  namespace Express {
    interface Request {
      sessionCollectionId?: string;
      sessionRole?: SessionRole;
    }
  }
}

export interface ResolvedSession {
  collectionId: string;
  role: SessionRole;
}

// Núcleo compartilhado entre o middleware HTTP abaixo e a autenticação de socket
// (realtime.ts) — resolve um token (cliente OU consultor) para a mesma
// CollectionRequest, sem tocar em requireCollectionToken (usado pelo /coleta).
export async function resolveSessionToken(
  collectionId: string | undefined,
  token: string | undefined
): Promise<ResolvedSession | null> {
  if (!collectionId || !token) return null;

  const tokenHash = hashToken(token);
  const collection = await prisma.collectionRequest.findUnique({ where: { id: collectionId } });
  if (!collection) return null;
  if (collection.status === "CANCELLED") return null;
  if (collection.expiresAt.getTime() < Date.now()) return null;

  if (collection.tokenHash === tokenHash) return { collectionId: collection.id, role: "CLIENT" };
  if (collection.agentTokenHash === tokenHash) return { collectionId: collection.id, role: "AGENT" };
  return null;
}

// Autoriza tanto o cliente quanto o consultor na mesma sala de atendimento, a partir
// de dois tokens distintos (tokenHash / agentTokenHash) da mesma CollectionRequest —
// não altera nem reaproveita requireCollectionToken (usado pelo formulário /coleta).
export async function requireSessionToken(req: Request, _res: Response, next: NextFunction) {
  const token = (req.query.token as string) || (req.body?.token as string);
  const resolved = await resolveSessionToken(req.params.collectionId, token);
  if (!resolved) return next(Errors.unauthorized("Sessão inválida."));

  req.sessionCollectionId = resolved.collectionId;
  req.sessionRole = resolved.role;
  next();
}

export function requireAgent(req: Request, _res: Response, next: NextFunction) {
  if (req.sessionRole !== "AGENT") return next(Errors.forbidden("Ação restrita ao consultor."));
  next();
}

// Autoriza QUALQUER coleta pra quem estiver logado no painel do consultor (senha
// compartilhada da equipe — sem link/token por coleta), OU o cliente dono do link
// daquela coleta específica (fluxo antigo, token na query/body). O consultor não
// precisa mais de um agentLink único por coleta.
export async function requireRoomAccess(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const agentToken = authHeader.slice("Bearer ".length);
    if (!verifyAgentSessionToken(agentToken)) {
      return next(Errors.unauthorized("Sessão do consultor expirada. Faça login novamente."));
    }
    req.sessionCollectionId = req.params.collectionId;
    req.sessionRole = "AGENT";
    return next();
  }
  return requireSessionToken(req, _res, next);
}
