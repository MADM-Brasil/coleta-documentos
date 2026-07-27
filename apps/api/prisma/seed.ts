import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { DEFAULT_ITEMS } from "../src/modules/collections/default-items";

const prisma = new PrismaClient();

function generateToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

async function main() {
  const client = await prisma.client.create({
    data: {
      name: "João da Silva",
      phone: "11999999999",
      email: "joao@example.com",
    },
  });

  const { raw, hash } = generateToken();

  const collection = await prisma.collectionRequest.create({
    data: {
      clientId: client.id,
      tokenHash: hash,
      status: "SENT",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      items: { create: DEFAULT_ITEMS },
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: "company" },
    update: {},
    create: {
      key: "company",
      value: JSON.stringify({
        name: "MADM",
        primaryColor: "#3B82F6",
        completionMessage: "Coleta concluída com sucesso. Obrigado!",
        maxFileSizeMb: 200,
        maxVideoDurationSeconds: 300,
        linkValidityDays: 7,
      }),
    },
  });

  console.log("Seed concluído.");
  console.log(`Link de coleta de teste: http://localhost:5173/coleta/${raw}`);
  console.log(`Collection ID: ${collection.id}`);
  console.log("");
  console.log("Exemplo de chamada de webhook (Make/Integromat):");
  console.log(`curl -X POST http://localhost:4000/webhook/collections \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "X-Webhook-Secret: <WEBHOOK_SECRET do .env>" \\`);
  console.log(`  -d '{"name":"Maria Oliveira","phone":"11988887777","externalId":"crm-123"}'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
