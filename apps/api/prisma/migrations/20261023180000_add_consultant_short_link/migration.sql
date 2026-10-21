-- Link curto pro consultor (/c/:code), espelhando o que já existe pro cliente (/s/:code).
ALTER TABLE "collection_requests" ADD COLUMN "consultantTokenPlain" TEXT;
ALTER TABLE "collection_requests" ADD COLUMN "consultantShortCode" TEXT;
CREATE UNIQUE INDEX "collection_requests_consultantShortCode_key" ON "collection_requests"("consultantShortCode");
