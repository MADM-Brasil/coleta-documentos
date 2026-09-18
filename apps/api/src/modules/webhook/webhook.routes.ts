import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middlewares/error";
import { Errors } from "../../lib/errors";
import { generateCollectionToken, generateShortCode } from "../../lib/token";
import { DEFAULT_ITEMS } from "../collections/default-items";
import { storageService } from "../storage";
import { env } from "../../config/env";

const router = Router();

async function generateUniqueShortCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateShortCode();
    const exists = await prisma.collectionRequest.findUnique({ where: { shortCode: code } });
    if (!exists) return code;
  }
  throw new Error("Não foi possível gerar um código curto único.");
}

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

    let client = externalId ? await prisma.client.findFirst({ where: { externalId } }) : null;
    if (!client) {
      client = await prisma.client.create({ data: { name, phone, email, externalId } });
    }

    const { raw, hash } = generateCollectionToken();
    const consultant = generateCollectionToken();
    const shortCode = await generateUniqueShortCode();

    // Uma URL fixa configurada no servidor (DEFAULT_CALLBACK_URL) sempre tem prioridade
    // sobre o que vier no corpo da requisição — assim o Make não precisa mais mandar
    // "callbackUrl" a cada chamada.
    const effectiveCallbackUrl = env.defaultCallbackUrl ?? callbackUrl;

    const collection = await prisma.collectionRequest.create({
      data: {
        clientId: client.id,
        tokenHash: hash,
        tokenPlain: raw,
        shortCode,
        consultantTokenHash: consultant.hash,
        status: "SENT",
        callbackUrl: effectiveCallbackUrl,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        items: { create: DEFAULT_ITEMS },
      },
    });

    // "link" vai pro CRM primeiro e é a tela do consultor (acompanhamento em tempo
    // real, só leitura); dentro dela tem a opção de copiar "clientLink" pra mandar
    // pro cliente preencher no celular.
    res.status(201).json({
      tipo: "LINK",
      collectionId: collection.id,
      link: `${env.clientUrl}/acompanhar/${consultant.raw}`,
      clientLink: `${env.appUrl}/s/${shortCode}`,
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
    // "inline" (em vez de "attachment") deixa o navegador exibir o arquivo direto
    // (imagem, PDF, vídeo) em vez de forçar o download — usado no preview do consultor.
    res.setHeader("Content-Disposition", `inline; filename="${media.originalFilename}"`);
    res.sendFile(filePath);
  })
);

// Link curto que o consultor compartilha com o cliente — só redireciona pro
// link real de coleta, não autentica nada por si só. Montado na raiz da API
// (não em /webhook) pra manter o link o mais curto possível.
export const shortLinkRouter = Router();
shortLinkRouter.get(
  "/s/:code",
  asyncHandler(async (req, res) => {
    const collection = await prisma.collectionRequest.findUnique({ where: { shortCode: req.params.code } });
    if (!collection || !collection.tokenPlain) throw Errors.notFound("Link não encontrado.");
    res.redirect(`${env.clientUrl}/coleta/${collection.tokenPlain}`);
  })
);

export default router;
