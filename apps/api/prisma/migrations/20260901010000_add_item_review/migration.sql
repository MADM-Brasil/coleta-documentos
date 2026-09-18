-- Fluxo de aprovação: item passa por PENDING -> UPLOADED (aguardando análise) ->
-- APPROVED ou REJECTED (com motivo em reviewNote, permitindo reenvio pelo cliente).
ALTER TABLE "collection_items" ADD COLUMN "reviewNote" TEXT;
