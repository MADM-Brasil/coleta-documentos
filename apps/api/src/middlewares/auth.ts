import { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/token";
import { env } from "../config/env";

declare global {
  namespace Express {
    interface Request {
      collectionRequestId?: string;
    }
  }
}

// Protege o webhook de automação (Make/Integromat): exige um segredo compartilhado,
// nunca login de usuário — quem chama é o CRM, não uma pessoa.
export function requireWebhookSecret(req: Request, _res: Response, next: NextFunction) {
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== env.webhookSecret) {
    return next(Errors.unauthorized("Segredo de webhook inválido ou ausente."));
  }
  next();
}

export async function requireCollectionToken(req: Request, _res: Response, next: NextFunction) {
  const { token } = req.params;
  if (!token) return next(Errors.unauthorized("Link inválido."));

  const tokenHash = hashToken(token);
  const collection = await prisma.collectionRequest.findUnique({ where: { tokenHash } });

  if (!collection) return next(Errors.notFound("Link de coleta não encontrado."));
  if (collection.status === "CANCELLED") return next(Errors.forbidden("Este link foi revogado."));
  if (collection.expiresAt.getTime() < Date.now()) return next(Errors.expired());

  req.collectionRequestId = collection.id;
  next();
}
