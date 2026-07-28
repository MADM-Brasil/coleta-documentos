import { StorageService } from "./storage.service";
import { LocalStorageService } from "./local-storage.service";
import { r2StorageService } from "./r2-storage.service";
import { cloudinaryStorageService } from "./cloudinary-storage.service";

// Troca automaticamente conforme STORAGE_PROVIDER:
// "CLOUDINARY" (upload devolve URL pública permanente), "R2" (Cloudflare, URL assinada),
// "LOCAL" (disco do servidor — só para desenvolvimento, não persiste entre deploys).
function pickStorageService(): StorageService {
  switch (process.env.STORAGE_PROVIDER) {
    case "CLOUDINARY":
      return cloudinaryStorageService;
    case "R2":
      return r2StorageService;
    default:
      return new LocalStorageService();
  }
}

export const storageService: StorageService = pickStorageService();
