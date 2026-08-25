import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { Errors } from "../../lib/errors";
import { env } from "../../config/env";
import { createAgentSessionToken, verifyAgentSessionToken } from "../../lib/agent-session";
import { createCollectionRequest, reissueClientLink } from "../collections/collections.service";

const router = Router();

function requireAgentAuth(req: import("express").Request) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!verifyAgentSessionToken(token)) throw Errors.unauthorized("Sessão expirada. Faça login novamente.");
}

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
    requireAgentAuth(req);

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
        agentName: c.agentName,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        approvedCount: c.items.filter((i) => i.status === "APPROVED").length,
        totalCount: c.items.length,
      })),
    });
  })
);

const createSessionSchema = z.object({
  name: z.string().min(1),
  agentName: z.string().min(1).optional(),
  // ID do lead no CRM (Kommo/HubSpot) — sem isso, o webhook pro Make sai com
  // leadId vazio e ele não sabe em qual lead anexar o documento.
  externalId: z.string().min(1).optional(),
});

// Criação manual de uma sessão de atendimento pelo consultor (fora do fluxo automático
// do Make) — gera a coleta e devolve o clientLink pronto pra compartilhar (ex: WhatsApp).
router.post(
  "/collections",
  asyncHandler(async (req, res) => {
    requireAgentAuth(req);
    const { name, agentName, externalId } = createSessionSchema.parse(req.body);

    const { collection, clientLink } = await createCollectionRequest({
      name,
      agentName,
      externalId,
      expiresInDays: 2,
    });

    res.status(201).json({ collectionId: collection.id, clientLink });
  })
);

// Gera um novo link de cliente para uma sessão já existente (o token bruto não fica
// guardado no banco — só o hash — então "Compartilhar" numa sessão antiga precisa
// emitir um token novo, invalidando o anterior).
router.post(
  "/collections/:collectionId/relink",
  asyncHandler(async (req, res) => {
    requireAgentAuth(req);
    const collection = await prisma.collectionRequest.findUnique({ where: { id: req.params.collectionId } });
    if (!collection) throw Errors.notFound("Atendimento não encontrado.");

    const clientLink = await reissueClientLink(collection.id);
    res.json({ clientLink });
  })
);

export default router;
