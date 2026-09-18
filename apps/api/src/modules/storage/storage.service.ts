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
  // Recebe o caminho de um arquivo temporário em disco (não o buffer inteiro em
  // memória) — os uploads são gravados em disco via streaming pelo multer, e cada
  // provedor lê/transmite a partir daí. Evita segurar arquivos grandes (vídeos) na
  // RAM do servidor, que é limitada no plano gratuito do Render.
  upload(filePath: string, options: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string): Promise<string>;
}
