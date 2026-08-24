-- Sala de atendimento (vídeo): token do consultor e motivo de reenvio de documento.
ALTER TABLE "collection_requests" ADD COLUMN "agentTokenHash" TEXT;
CREATE UNIQUE INDEX "collection_requests_agentTokenHash_key" ON "collection_requests"("agentTokenHash");

ALTER TABLE "collection_items" ADD COLUMN "rejectionReason" TEXT;
