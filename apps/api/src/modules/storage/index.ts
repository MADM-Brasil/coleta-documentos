import { StorageService } from "./storage.service";
import { LocalStorageService } from "./local-storage.service";
import { r2StorageService } from "./r2-storage.service";

// Troca automaticamente conforme STORAGE_PROVIDER: "R2" usa Cloudflare R2 (persistente,
// sobrevive a redeploys), "LOCAL" usa disco do servidor (só para desenvolvimento —
// não persiste entre deploys/reinícios).
export const storageService: StorageService =
  process.env.STORAGE_PROVIDER === "R2" ? r2StorageService : new LocalStorageService();
