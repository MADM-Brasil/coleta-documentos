import { Router } from "express";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { requireWebhookSecret } from "../../middlewares/auth";
import { Errors } from "../../lib/errors";
import { generateCollectionToken } from "../../lib/token";
import { DEFAULT_ITEMS } from "../collections/default-items";
import { env } from "../../config/env";

const router = Router();
router.use(requireWebhookSecret);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  externalId: z.string().optional(),
  expiresInDays: z.number().min(1).max(90).default(7),
  // URL do gatilho "Custom Webhook" do Make — o sistema chama essa URL em tempo real
  // a cada documento enviado e quando a coleta é concluída.
  callbackUrl: z.string().url().optional(),
});

// Chamado pelo Make/Integromat quando o card do CRM entra na etapa "Coleta de Documentação".
// Cria (ou reaproveita, via externalId) o cliente, gera a coleta e devolve o link único
// para o próprio Make inserir de volta no CRM.
router.post(
  "/collections",
  asyncHandler(async (req, res) => {
    const { name, phone, email, externalId, expiresInDays, callbackUrl } = createSchema.parse(req.body);

    let client = externalId ? await prisma.client.findFirst({ where: { externalId } }) : null;
    if (!client) {
      client = await prisma.client.create({ data: { name, phone, email, externalId } });
    }

    const { raw, hash } = generateCollectionToken();

    const collection = await prisma.collectionRequest.create({
      data: {
        clientId: client.id,
        tokenHash: hash,
        status: "SENT",
        callbackUrl,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        items: { create: DEFAULT_ITEMS },
      },
    });

    res.status(201).json({
      collectionId: collection.id,
      token: raw,
      link: `${env.clientUrl}/coleta/${raw}`,
      expiresAt: collection.expiresAt,
    });
  })
);

// Permite ao Make baixar o arquivo (foto/áudio/vídeo) para anexar na Kommo,
// Google Drive etc. Protegido pelo mesmo segredo do webhook — nunca é público.
router.get(
  "/media/:mediaId",
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaFile.findUnique({ where: { id: req.params.mediaId } });
    if (!media || media.status === "DELETED") throw Errors.notFound("Mídia não encontrada.");

    const filePath = path.resolve(process.cwd(), env.uploadsDir, media.storageKey);
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${media.originalFilename}"`);
    res.sendFile(filePath);
  })
);

export default router;
