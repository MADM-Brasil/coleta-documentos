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

  // Não usado no modo LOCAL — a rota /webhook/media/:mediaId lê o arquivo do disco
  // diretamente. Existe só para satisfazer a interface comum com o R2.
  async getSignedUrl(key: string): Promise<string> {
    return `/webhook/media/${key}`;
  }
}
