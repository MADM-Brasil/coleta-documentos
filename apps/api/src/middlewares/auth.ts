import { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/token";

declare global {
  namespace Express {
    interface Request {
      collectionRequestId?: string;
    }
  }
}

export async function requireCollectionToken(req: Request, _res: Response, next: NextFunction) {
  const { token } = req.params;
  if (!token) return next(Errors.unauthorized("Link inválido."));

  // Aceita tanto o código curto (novo padrão da URL, ex: /coleta/AbCd1234) quanto
  // o token longo antigo (base64url, pra não quebrar links já compartilhados).
  const tokenHash = hashToken(token);
  const collection = await prisma.collectionRequest.findFirst({
    where: { OR: [{ shortCode: token }, { tokenHash }] },
  });

  if (!collection) return next(Errors.notFound("Link de coleta não encontrado."));
  if (collection.status === "CANCELLED") return next(Errors.forbidden("Este link foi revogado."));
  if (collection.expiresAt.getTime() < Date.now()) return next(Errors.expired());

  req.collectionRequestId = collection.id;
  next();
}

// Link do consultor: só leitura, mesmo modelo do token do cliente mas numa
// coluna separada — não deixa fazer upload, só ver o status em tempo real.
export async function requireConsultantToken(req: Request, _res: Response, next: NextFunction) {
  const { token } = req.params;
  if (!token) return next(Errors.unauthorized("Link inválido."));

  const tokenHash = hashToken(token);
  const collection = await prisma.collectionRequest.findFirst({
    where: { OR: [{ consultantShortCode: token }, { consultantTokenHash: tokenHash }] },
  });

  if (!collection) return next(Errors.notFound("Link de acompanhamento não encontrado."));
  if (collection.status === "CANCELLED") return next(Errors.forbidden("Este link foi revogado."));
  if (collection.expiresAt.getTime() < Date.now()) return next(Errors.expired());

  req.collectionRequestId = collection.id;
  next();
}
