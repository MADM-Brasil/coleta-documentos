-- Código curto pra encurtar o link do cliente compartilhado pelo consultor.
ALTER TABLE "collection_requests" ADD COLUMN "shortCode" TEXT;
CREATE UNIQUE INDEX "collection_requests_shortCode_key" ON "collection_requests"("shortCode");
