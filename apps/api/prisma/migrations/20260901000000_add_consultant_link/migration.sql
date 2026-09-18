-- Link de acompanhamento em tempo real do consultor (só leitura), separado do
-- link do cliente. tokenPlain guarda o token do cliente em texto plano só pra
-- poder ser exibido/copiado na tela do consultor.
ALTER TABLE "collection_requests" ADD COLUMN "consultantTokenHash" TEXT;
ALTER TABLE "collection_requests" ADD COLUMN "tokenPlain" TEXT;
CREATE UNIQUE INDEX "collection_requests_consultantTokenHash_key" ON "collection_requests"("consultantTokenHash");
