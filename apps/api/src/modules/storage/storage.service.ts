export interface UploadOptions {
  key: string;
  mimeType: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface StorageService {
  upload(file: Buffer, options: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string): Promise<string>;
}
