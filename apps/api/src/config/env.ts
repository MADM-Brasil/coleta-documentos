import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  appUrl: required("APP_URL", "http://localhost:4000"),
  clientUrl: required("CLIENT_URL", "http://localhost:5173"),
  storageProvider: process.env.STORAGE_PROVIDER ?? "LOCAL",
  uploadsDir: process.env.UPLOADS_DIR ?? "./uploads",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 200),
};
