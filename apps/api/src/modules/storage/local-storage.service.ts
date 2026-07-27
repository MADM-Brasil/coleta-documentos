import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { StorageService, UploadOptions, UploadResult } from "./storage.service";

const uploadsRoot = path.resolve(process.cwd(), env.uploadsDir);

export class LocalStorageService implements StorageService {
  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    await fs.mkdir(uploadsRoot, { recursive: true });
    const filePath = path.join(uploadsRoot, options.key);
    await fs.writeFile(filePath, file);
    return { key: options.key, url: `/uploads/${options.key}`, size: file.length };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(uploadsRoot, key);
    await fs.rm(filePath, { force: true });
  }

  // Simula uma "signed URL": em dev, o próprio backend serve o arquivo por trás
  // de autenticação (rota protegida), sem expor o diretório publicamente.
  async getSignedUrl(key: string): Promise<string> {
    return `/api/media/file/${key}`;
  }
}

export const storageService: StorageService = new LocalStorageService();
