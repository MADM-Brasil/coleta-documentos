import { prisma } from "../../lib/prisma";
import { generateCollectionToken } from "../../lib/token";
import { DEFAULT_ITEMS } from "./default-items";
import { env } from "../../config/env";

interface CreateCollectionParams {
  name: string;
  phone?: string;
  email?: string;
  externalId?: string;
  expiresInDays: number;
  callbackUrl?: string;
  // Só exibição (tabela do painel) — não tem relação com autenticação.
  agentName?: string;
}

// Núcleo compartilhado entre o webhook do Make (POST /webhook/collections) e a criação
// manual pelo consultor (POST /api/agent/collections) — o cliente e o item padrão são
// sempre os mesmos, só muda quem chamou.
export async function createCollectionRequest(params: CreateCollectionParams) {
  const { name, phone, email, externalId, expiresInDays, callbackUrl, agentName } = params;

  let client = externalId ? await prisma.client.findFirst({ where: { externalId } }) : null;
  if (!client) {
    client = await prisma.client.create({ data: { name, phone, email, externalId } });
  }

  const { raw, hash } = generateCollectionToken();
  const effectiveCallbackUrl = env.defaultCallbackUrl ?? callbackUrl;

  const collection = await prisma.collectionRequest.create({
    data: {
      clientId: client.id,
      tokenHash: hash,
      agentName,
      status: "SENT",
      callbackUrl: effectiveCallbackUrl,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      items: { create: DEFAULT_ITEMS },
    },
  });

  const clientLink = `${env.clientUrl}/atendimento/${collection.id}?token=${raw}`;
  return { collection, clientLink };
}

// Gera um novo token de cliente para uma coleta já existente (invalida o link
// anterior) — usado quando o consultor clica em "Compartilhar" pra reenviar o link
// de uma sessão que já existia sem que ele tivesse o token à mão.
export async function reissueClientLink(collectionId: string) {
  const { raw, hash } = generateCollectionToken();
  const collection = await prisma.collectionRequest.update({
    where: { id: collectionId },
    data: { tokenHash: hash },
  });
  return `${env.clientUrl}/atendimento/${collection.id}?token=${raw}`;
}
