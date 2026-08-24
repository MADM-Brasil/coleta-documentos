import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { asyncHandler } from "../../middlewares/error";
import { requireSessionToken, requireAgent } from "../../middlewares/session-auth";
import { Errors } from "../../lib/errors";
import { recordEvent } from "../collections/events.service";
import { createLiveKitToken, isLiveKitConfigured, roomNameFor } from "./livekit.service";
import { emitToRoom } from "./realtime";

const router = Router();

// Camada nova sobre a coleta existente — nenhuma rota aqui substitui ou altera
// /webhook/* ou /public/collections/* (upload, callback ao Make continuam intactos).
router.post(
  "/:collectionId/token",
  requireSessionToken,
  asyncHandler(async (req, res) => {
    if (!isLiveKitConfigured()) {
      throw Errors.validation("Videochamada ainda não configurada no servidor.");
    }
    const collection = await prisma.collectionRequest.findUnique({
      where: { id: req.sessionCollectionId },
      include: { client: true },
    });
    if (!collection) throw Errors.notFound();

    const identity = `${req.sessionRole!.toLowerCase()}-${collection.id}`;
    const name = req.sessionRole === "AGENT" ? "Consultor" : collection.client.name;

    const token = await createLiveKitToken({
      collectionId: collection.id,
      role: req.sessionRole!,
      identity,
      name,
    });

    res.json({
      livekitToken: token,
      livekitUrl: env.livekitUrl,
      roomName: roomNameFor(collection.id),
      role: req.sessionRole,
      collection: { id: collection.id, status: collection.status, clientName: collection.client.name },
    });
  })
);

// Visão da coleta para o consultor (o cliente já tem GET /public/collections/:token).
router.get(
  "/:collectionId",
  requireSessionToken,
  requireAgent,
  asyncHandler(async (req, res) => {
    const collection = await prisma.collectionRequest.findUnique({
      where: { id: req.sessionCollectionId },
      include: {
        client: true,
        items: { include: { mediaFiles: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!collection) throw Errors.notFound();

    res.json({
      id: collection.id,
      status: collection.status,
      client: { name: collection.client.name },
      items: collection.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        required: item.required,
        status: item.status,
        multiple: item.multiple,
        rejectionReason: item.rejectionReason,
        media: item.mediaFiles.filter((m) => m.status === "UPLOADED"),
      })),
    });
  })
);

const rejectSchema = z.object({ reason: z.string().min(1).max(300) });

router.post(
  "/:collectionId/items/:itemId/approve",
  requireSessionToken,
  requireAgent,
  asyncHandler(async (req, res) => {
    const item = await prisma.collectionItem.findFirst({
      where: { id: req.params.itemId, collectionRequestId: req.sessionCollectionId },
    });
    if (!item) throw Errors.notFound("Item não encontrado.");
    if (item.status !== "UPLOADED") {
      throw Errors.validation("Só é possível aprovar um item que já foi enviado.");
    }

    const updated = await prisma.collectionItem.update({
      where: { id: item.id },
      data: { status: "APPROVED", rejectionReason: null },
    });
    await recordEvent(req.sessionCollectionId!, "item:approved", "SYSTEM", { itemId: item.id });
    emitToRoom(req.sessionCollectionId!, "document_approved", { itemId: item.id });

    res.json({ item: updated });
  })
);

router.post(
  "/:collectionId/items/:itemId/reject",
  requireSessionToken,
  requireAgent,
  asyncHandler(async (req, res) => {
    const { reason } = rejectSchema.parse(req.body);
    const item = await prisma.collectionItem.findFirst({
      where: { id: req.params.itemId, collectionRequestId: req.sessionCollectionId },
    });
    if (!item) throw Errors.notFound("Item não encontrado.");

    const updated = await prisma.collectionItem.update({
      where: { id: item.id },
      data: { status: "REJECTED", rejectionReason: reason },
    });
    await recordEvent(req.sessionCollectionId!, "item:rejected", "SYSTEM", { itemId: item.id, reason });
    emitToRoom(req.sessionCollectionId!, "document_rejected", { itemId: item.id, reason });

    res.json({ item: updated });
  })
);

// Sinaliza a conclusão da documentação (evento em tempo real para as duas telas). Não
// chama o webhook do Make/HubSpot — isso continua exclusivamente pelo botão "Finalizar
// Envio" do cliente (rota /public/collections/:token/finish), para não alterar o fluxo atual.
router.post(
  "/:collectionId/complete",
  requireSessionToken,
  requireAgent,
  asyncHandler(async (req, res) => {
    emitToRoom(req.sessionCollectionId!, "collection_completed");
    res.json({ ok: true });
  })
);

export default router;
