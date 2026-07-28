import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { StorageService, UploadOptions, UploadResult } from "./storage.service";

const accountId = process.env.R2_ACCOUNT_ID ?? "";
const bucket = process.env.R2_BUCKET_NAME ?? "";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export class R2StorageService implements StorageService {
  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: file,
        ContentType: options.mimeType,
      })
    );
    return { key: options.key, url: options.key, size: file.length };
  }

  async delete(key: string): Promise<void> {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  // URL assinada, expira em 5 minutos — suficiente para o Make baixar o arquivo na hora.
  async getSignedUrl(key: string): Promise<string> {
    return presign(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  }
}

export const r2StorageService: StorageService = new R2StorageService();
