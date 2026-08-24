import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { Errors } from "../../lib/errors";
import { createCollectionRequest } from "../collections/collections.service";
import { storageService } from "../storage";
import { env } from "../../config/env";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  externalId: z.string().optional(),
  // Padrão de 2 dias (48h) — prazo para o cliente concluir o envio antes do link expirar.
  expiresInDays: z.number().min(1).max(90).default(2),
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

    const { collection, clientLink } = await createCollectionRequest({
      name,
      phone,
      email,
      externalId,
      expiresInDays,
      callbackUrl,
    });

    // "link" (= agentLink) é o que o Make coloca na nota/CRM pro CONSULTOR — abre a sala
    // direto (pede login com a senha da equipe se ainda não estiver logado). O consultor
    // é quem manda o clientLink pro cliente, clicando em "Compartilhar" dentro da sala.
    const agentLink = `${env.clientUrl}/painel/atendimento/${collection.id}`;

    res.status(201).json({
      tipo: "LINK",
      collectionId: collection.id,
      link: agentLink,
      agentLink,
      clientLink,
      expiresAt: collection.expiresAt,
    });
  })
);

// Permite ao Make baixar o arquivo (foto/áudio/vídeo) para anexar na Kommo, Google Drive etc.
router.get(
  "/media/:mediaId",
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaFile.findUnique({ where: { id: req.params.mediaId } });
    if (!media || media.status === "DELETED") throw Errors.notFound("Mídia não encontrada.");

    if (media.url) {
      return res.redirect(media.url);
    }

    if (env.storageProvider === "R2") {
      const signedUrl = await storageService.getSignedUrl(media.storageKey);
      return res.redirect(signedUrl);
    }

    const filePath = path.resolve(process.cwd(), env.uploadsDir, media.storageKey);
    if (!fs.existsSync(filePath)) {
      // Plano gratuito do Render não tem disco persistente: o arquivo pode ter sido
      // apagado num redeploy/reinício do servidor depois do upload.
      throw Errors.notFound(
        "O arquivo não está mais disponível no servidor (provavelmente foi perdido num reinício). Peça para o cliente reenviar o documento."
      );
    }

    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${media.originalFilename}"`);
    res.sendFile(filePath);
  })
);

export default router;
