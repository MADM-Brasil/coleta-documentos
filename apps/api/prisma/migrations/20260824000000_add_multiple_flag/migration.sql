-- Permite anexar vários arquivos no mesmo item (ex: vários laudos médicos em PDF)
ALTER TABLE "collection_items" ADD COLUMN "multiple" BOOLEAN NOT NULL DEFAULT false;
