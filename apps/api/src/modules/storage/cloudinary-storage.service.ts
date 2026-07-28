import { v2 as cloudinary } from "cloudinary";
import { StorageService, UploadOptions, UploadResult } from "./storage.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function resourceTypeFor(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  return "raw";
}

export class CloudinaryStorageService implements StorageService {
  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    const resourceType = resourceTypeFor(options.mimeType);
    // O Cloudinary já anexa a extensão certa sozinho (baseado no conteúdo) —
    // tirar a extensão do nosso key evita gerar "arquivo.png.png".
    const publicId = options.key.replace(/\.[a-zA-Z0-9]+$/, "");

    const result = await new Promise<{ public_id: string; secure_url: string; bytes: number }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: resourceType, public_id: publicId, folder: "forms-madm" },
          (err, res) => {
            if (err || !res) return reject(err ?? new Error("Falha ao enviar para o Cloudinary."));
            resolve(res as any);
          }
        );
        stream.end(file);
      }
    );

    return { key: result.public_id, url: result.secure_url, size: result.bytes };
  }

  async delete(key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, { resource_type: "image" }).catch(() => {});
    await cloudinary.uploader.destroy(key, { resource_type: "video" }).catch(() => {});
    await cloudinary.uploader.destroy(key, { resource_type: "raw" }).catch(() => {});
  }

  // O Cloudinary já retorna uma URL pública e permanente no upload — nada a assinar aqui.
  async getSignedUrl(key: string): Promise<string> {
    return key;
  }
}

export const cloudinaryStorageService: StorageService = new CloudinaryStorageService();
