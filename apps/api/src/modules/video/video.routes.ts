import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { asyncHandler } from "../../middlewares/error";
import { requireRoomAccess, requireAgent } from "../../middlewares/session-auth";
import { Errors } from "../../lib/errors";
import { generateDescriptiveStorageKey } from "../../lib/token";
import { storageService } from "../storage";
import { recordEvent } from "../collections/events.service";
import { notifyCallback } from "../collections/callback.service";
import { createLiveKitToken, isLiveKitConfigured, roomNameFor } from "./livekit.service";
import { emitToRoom } from "./realtime";

const router = Router();

const uploadCapture = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
});

// Camada nova sobre a coleta existente — nenhuma rota aqui substitui ou altera
// /webhook/* ou /public/collections/* (upload, callback ao Make continuam intactos).
router.post(
  "/:collectionId/token",
  requireRoomAccess,
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
  requireRoomAccess,
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
  requireRoomAccess,
  requireAgent,
  asyncHandler(async (req, res) => {
    const item = await prisma.collectionItem.findFirst({
      where: { id: req.params.itemId, collectionRequestId: req.sessionCollectionId },
      include: { mediaFiles: true },
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

    // Só agora (aprovado pelo consultor) o Make é notificado — não no upload, pra não
    // mandar pro CRM algo que ainda pode ser recusado/reenviado.
    const media = item.mediaFiles.filter((m) => m.status === "UPLOADED").at(-1);
    if (media) {
      const downloadUrl = media.url ?? `${env.appUrl}/webhook/media/${media.id}`;
      void notifyCallback(req.sessionCollectionId!, item.type, downloadUrl);
    }

    res.json({ item: updated });
  })
);

router.post(
  "/:collectionId/items/:itemId/reject",
  requireRoomAccess,
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

// Consultor grava o áudio/vídeo do cliente durante a chamada (a partir dos tracks já
// recebidos via WebRTC) e envia direto — o cliente só vê um status "em andamento",
// sem precisar gravar nada pelo próprio celular (evita ter que abrir a câmera do
// sistema, que substituiria a câmera da própria chamada).
router.post(
  "/:collectionId/items/:itemId/agent-upload",
  requireRoomAccess,
  requireAgent,
  uploadCapture.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw Errors.validation("Nenhum arquivo recebido.");

    const item = await prisma.collectionItem.findFirst({
      where: { id: req.params.itemId, collectionRequestId: req.sessionCollectionId },
    });
    if (!item) throw Errors.notFound("Item não encontrado.");

    const storageKey = generateDescriptiveStorageKey(item.type, null, file.originalname);
    const uploadResult = await storageService.upload(file.buffer, { key: storageKey, mimeType: file.mimetype });

    const media = await prisma.mediaFile.create({
      data: {
        collectionItemId: item.id,
        storageProvider: env.storageProvider,
        storageKey: uploadResult.key,
        url: env.storageProvider === "CLOUDINARY" ? uploadResult.url : null,
        mimeType: file.mimetype,
        fileSize: file.size,
        originalFilename: file.originalname,
        status: "UPLOADED",
      },
    });

    await prisma.collectionItem.update({
      where: { id: item.id },
      data: { status: "UPLOADED", rejectionReason: null },
    });
    await recordEvent(req.sessionCollectionId!, "media:uploaded", "SYSTEM", {
      itemId: item.id,
      itemTitle: item.title,
      mediaId: media.id,
    });
    emitToRoom(req.sessionCollectionId!, "document_uploaded", { itemId: item.id });

    res.status(201).json({ media, itemStatus: "UPLOADED" });
  })
);

// Sinaliza a conclusão da documentação (evento em tempo real para as duas telas). Não
// chama o webhook do Make/HubSpot — isso continua exclusivamente pelo botão "Finalizar
// Envio" do cliente (rota /public/collections/:token/finish), para não alterar o fluxo atual.
router.post(
  "/:collectionId/complete",
  requireRoomAccess,
  requireAgent,
  asyncHandler(async (req, res) => {
    emitToRoom(req.sessionCollectionId!, "collection_completed");
    res.json({ ok: true });
  })
);

export default router;
