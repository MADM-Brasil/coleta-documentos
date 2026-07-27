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

  const tokenHash = hashToken(token);
  const collection = await prisma.collectionRequest.findUnique({ where: { tokenHash } });

  if (!collection) return next(Errors.notFound("Link de coleta não encontrado."));
  if (collection.status === "CANCELLED") return next(Errors.forbidden("Este link foi revogado."));
  if (collection.expiresAt.getTime() < Date.now()) return next(Errors.expired());

  req.collectionRequestId = collection.id;
  next();
}
