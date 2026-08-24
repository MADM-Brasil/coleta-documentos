import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { Errors } from "../../lib/errors";
import { env } from "../../config/env";
import { createAgentSessionToken, verifyAgentSessionToken } from "../../lib/agent-session";

const router = Router();

const loginSchema = z.object({ password: z.string().min(1) });

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    if (!env.agentPassword) {
      throw Errors.validation("Painel do consultor ainda não configurado no servidor.");
    }
    const { password } = loginSchema.parse(req.body);

    const ok =
      password.length === env.agentPassword.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(env.agentPassword));
    if (!ok) throw Errors.unauthorized("Senha incorreta.");

    res.json({ token: createAgentSessionToken() });
  })
);

// Lista os atendimentos ativos (não concluídos/cancelados/expirados) pro consultor
// escolher direto no painel, sem precisar de link específico por coleta.
router.get(
  "/collections",
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!verifyAgentSessionToken(token)) throw Errors.unauthorized("Sessão expirada. Faça login novamente.");

    const collections = await prisma.collectionRequest.findMany({
      where: { status: { in: ["SENT", "OPENED", "IN_PROGRESS"] } },
      include: { client: true, items: true },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      collections: collections.map((c) => ({
        id: c.id,
        status: c.status,
        clientName: c.client.name,
        updatedAt: c.updatedAt,
        approvedCount: c.items.filter((i) => i.status === "APPROVED").length,
        totalCount: c.items.length,
      })),
    });
  })
);

export default router;
