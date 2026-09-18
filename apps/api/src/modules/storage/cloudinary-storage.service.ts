import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
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
  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    const resourceType = resourceTypeFor(options.mimeType);
    // Para "image"/"video" o Cloudinary já anexa a extensão certa sozinho (baseado no
    // conteúdo) — tirar do nosso key evita "arquivo.png.png". Mas pra "raw" (PDFs) ele
    // NÃO anexa nada: sem extensão no public_id, o arquivo baixa sem ".pdf" e o
    // Windows/visualizador não reconhece o formato. Por isso mantemos a extensão só nesse caso.
    const publicId =
      resourceType === "raw" ? options.key : options.key.replace(/\.[a-zA-Z0-9]+$/, "");

    // upload_large lê o arquivo do disco por streaming e manda em pedaços — não
    // carrega o vídeo/arquivo inteiro na memória do servidor, e evita o limite de
    // tamanho do upload simples pra vídeos maiores.
    // O retorno de upload_large não é uma Promise de verdade (é o stream interno) —
    // precisa do callback explícito pra saber quando terminou.
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload_large(
        filePath,
        { resource_type: resourceType, public_id: publicId, folder: "forms-madm" },
        (err, res) => {
          if (err || !res) return reject(err ?? new Error("Falha ao enviar para o Cloudinary."));
          resolve(res);
        }
      );
    });

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
