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
  // Opcionais: quando ambos preenchidos, o sistema anexa o arquivo direto no lead da
  // Kommo (nota tipo "attachment") no momento do upload, sem depender do Make pra isso.
  kommoSubdomain: process.env.KOMMO_SUBDOMAIN,
  kommoApiToken: process.env.KOMMO_API_TOKEN,
  // Quando definida, toda coleta usa essa URL fixa para os eventos em tempo real
  // (documento enviado, coleta concluída), independente do que vier em "callbackUrl"
  // na chamada de criação — o Make não precisa mais mandar esse campo.
  defaultCallbackUrl: process.env.DEFAULT_CALLBACK_URL,
};
