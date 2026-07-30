import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { requireCollectionToken } from "../../middlewares/auth";
import { Errors } from "../../lib/errors";
import { generateDescriptiveStorageKey } from "../../lib/token";
import { storageService } from "../storage";
import { recordEvent } from "./events.service";
import { notifyCallback } from "./callback.service";
import { attachFileToKommoLead } from "../kommo/kommo-attachment.service";
import { env } from "../../config/env";

const router = Router();

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
});

router.get(
  "/:token",
  requireCollectionToken,
  asyncHandler(async (req, res) => {
    const collection = await prisma.collectionRequest.findUnique({
      where: { id: req.collectionRequestId },
      include: {
        client: true,
        items: { include: { mediaFiles: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!collection) throw Errors.notFound();

    if (!collection.openedAt) {
      await prisma.collectionRequest.update({
        where: { id: collection.id },
        data: { openedAt: new Date(), status: "OPENED" },
      });
      await recordEvent(collection.id, "collection:started", "CLIENT");
    }

    res.json({
      id: collection.id,
      status: collection.status,
      client: { name: collection.client.name },
      expiresAt: collection.expiresAt,
      items: collection.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        instructions: item.instructions,
        required: item.required,
        status: item.status,
        media: item.mediaFiles.filter((m) => m.status === "UPLOADED"),
      })),
    });
  })
);

router.post(
  "/:token/items/:itemId/upload",
  requireCollectionToken,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const file = req.file;
    if (!file) throw Errors.validation("Nenhum arquivo enviado.");

    const collectionBefore = await prisma.collectionRequest.findUnique({
      where: { id: req.collectionRequestId },
      include: { client: true },
    });
    if (collectionBefore?.status === "COMPLETED") {
      throw Errors.validation("Esta coleta já foi concluída. Entre em contato com o atendimento se precisar reenviar algo.");
    }

    const item = await prisma.collectionItem.findFirst({
      where: { id: itemId, collectionRequestId: req.collectionRequestId },
    });
    if (!item) throw Errors.notFound("Item de coleta não encontrado.");

    // file-type é ESM-only; import dinâmico evita conflito com moduleResolution CommonJS do restante da API.
    // @ts-ignore
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(file.buffer);
    const mimeType = detected?.mime ?? file.mimetype;
    if (!ALLOWED_MIME.has(mimeType)) {
      throw Errors.invalidFileType();
    }

    await prisma.mediaFile.updateMany({
      where: { collectionItemId: item.id, status: "UPLOADED" },
      data: { status: "REPLACED" },
    });

    const storageKey = generateDescriptiveStorageKey(
      item.type,
      collectionBefore!.client.externalId,
      file.originalname
    );
    const uploadResult = await storageService.upload(file.buffer, { key: storageKey, mimeType });

    const media = await prisma.mediaFile.create({
      data: {
        collectionItemId: item.id,
        storageProvider: env.storageProvider,
        storageKey: uploadResult.key,
        // Provedores como Cloudinary já devolvem uma URL pública e permanente no upload —
        // guardamos ela aqui para usar direto, sem depender do nosso servidor depois.
        url: env.storageProvider === "CLOUDINARY" ? uploadResult.url : null,
        mimeType,
        fileSize: file.size,
        originalFilename: file.originalname,
        status: "UPLOADED",
      },
    });

    await prisma.collectionItem.update({ where: { id: item.id }, data: { status: "UPLOADED" } });

    await recordEvent(req.collectionRequestId!, "media:uploaded", "CLIENT", {
      itemId: item.id,
      itemTitle: item.title,
      mediaId: media.id,
    });

    const items = await prisma.collectionItem.findMany({ where: { collectionRequestId: req.collectionRequestId } });
    const allSent = items.every((i) => i.status === "UPLOADED" || !i.required);

    let collectionStatus = collectionBefore!.status;
    if (allSent) {
      collectionStatus = "COMPLETED";
      await prisma.collectionRequest.update({
        where: { id: req.collectionRequestId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await recordEvent(req.collectionRequestId!, "collection:completed", "SYSTEM");
    } else if (collectionBefore!.status !== "IN_PROGRESS") {
      collectionStatus = "IN_PROGRESS";
      await prisma.collectionRequest.update({ where: { id: req.collectionRequestId }, data: { status: "IN_PROGRESS" } });
    }

    // Dispara em segundo plano — não atrasa a resposta ao cliente esperando o Make responder.
    // O arquivo já vai embutido em base64 (quando não for grande demais) para o Make
    // conseguir anexar direto na Kommo sem depender de buscar depois.
    const downloadUrl = media.url ?? `${env.appUrl}/webhook/media/${media.id}`;
    void notifyCallback(req.collectionRequestId!, item.type, downloadUrl, {
      buffer: file.buffer,
      mimeType,
      filename: file.originalname,
      publicId: env.storageProvider === "CLOUDINARY" ? media.storageKey : undefined,
    });
    if (collectionStatus === "COMPLETED") {
      void notifyCallback(req.collectionRequestId!, "CONCLUIDO", downloadUrl);
    }

    // Anexa direto no lead da Kommo (nota nativa, com miniatura/download reais) quando
    // KOMMO_SUBDOMAIN e KOMMO_API_TOKEN estiverem configurados — sem eles, não faz nada.
    void attachFileToKommoLead(collectionBefore!.client.externalId, file.buffer, mimeType, file.originalname);

    res.status(201).json({ media, itemStatus: "UPLOADED", collectionStatus });
  })
);

export default router;
