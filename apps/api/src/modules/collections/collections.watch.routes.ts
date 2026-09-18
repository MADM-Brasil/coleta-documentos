import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { requireConsultantToken } from "../../middlewares/auth";
import { Errors } from "../../lib/errors";
import { recordEvent } from "./events.service";
import { notifyCallback } from "./callback.service";
import { env } from "../../config/env";

const router = Router();

// Tela do consultor: só leitura, sem upload. Usada pra acompanhar em tempo real
// (via polling no front) o envio dos documentos pelo cliente.
router.get(
  "/:token",
  requireConsultantToken,
  asyncHandler(async (req, res) => {
    const collection = await prisma.collectionRequest.findUnique({
      where: { id: req.collectionRequestId },
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
      expiresAt: collection.expiresAt,
      // Link curto (redireciona via /s/:code) — cai pro link completo se a coleta
      // for antiga e não tiver shortCode.
      clientLink: collection.shortCode
        ? `${env.appUrl}/s/${collection.shortCode}`
        : collection.tokenPlain
          ? `${env.clientUrl}/coleta/${collection.tokenPlain}`
          : null,
      items: collection.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        required: item.required,
        status: item.status,
        multiple: item.multiple,
        reviewNote: item.reviewNote,
        media: item.mediaFiles
          .filter((m) => m.status === "UPLOADED")
          .map((m) => ({
            id: m.id,
            // Sem storage com URL pública (ex: LOCAL em dev), cai no endpoint que
            // serve o arquivo direto do servidor — assim o consultor sempre consegue
            // abrir/pré-visualizar, mesmo sem Cloudinary configurado.
            url: m.url ?? `${env.appUrl}/webhook/media/${m.id}`,
            mimeType: m.mimeType,
            originalFilename: m.originalFilename,
            createdAt: m.createdAt,
          })),
      })),
    });
  })
);

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

// Consultor aprova ou reprova um documento enviado. Reprovar volta o item pro
// cliente com o motivo — o cliente pode reenviar, o que já muda o status pra
// "aguardando análise" de novo (mesma rota de upload existente).
router.post(
  "/:token/items/:itemId/review",
  requireConsultantToken,
  asyncHandler(async (req, res) => {
    const { action, reason } = reviewSchema.parse(req.body);

    const item = await prisma.collectionItem.findFirst({
      where: { id: req.params.itemId, collectionRequestId: req.collectionRequestId },
      include: { mediaFiles: true },
    });
    if (!item) throw Errors.notFound("Item de coleta não encontrado.");
    if (item.status !== "UPLOADED") {
      throw Errors.validation("Este item não está aguardando análise.");
    }

    const updated = await prisma.collectionItem.update({
      where: { id: item.id },
      data:
        action === "approve"
          ? { status: "APPROVED", reviewNote: null }
          : { status: "REJECTED", reviewNote: reason ?? null },
    });

    await recordEvent(req.collectionRequestId!, action === "approve" ? "item:approved" : "item:rejected", "SYSTEM", {
      itemId: item.id,
      itemTitle: item.title,
      reason,
    });

    // Só agora, com o documento aprovado pelo consultor, o Make/CRM é notificado.
    // Roda em segundo plano pra não segurar a resposta do "Aprovar" esperando o
    // download do arquivo (pode levar alguns segundos por PDF).
    if (action === "approve") {
      const activeMedia = item.mediaFiles.filter((m) => m.status === "UPLOADED");
      void (async () => {
        for (const media of activeMedia) {
          const downloadUrl = media.url ?? `${env.appUrl}/webhook/media/${media.id}`;
          // Reconstrói o buffer a partir do arquivo já armazenado (Cloudinary etc.) —
          // no upload não guardamos os bytes, só o link, pra não segurar memória à toa.
          const buffer = media.url ? await fetchBuffer(media.url) : null;
          await notifyCallback(req.collectionRequestId!, item.type, downloadUrl, {
            buffer,
            mimeType: media.mimeType,
            filename: media.originalFilename,
            publicId: media.storageProvider === "CLOUDINARY" ? media.storageKey : undefined,
          });
        }
      })();
    }

    res.json({ id: updated.id, status: updated.status, reviewNote: updated.reviewNote });
  })
);

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export default router;
