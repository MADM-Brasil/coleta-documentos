import axios from "axios";

// Em dev, o Vite faz proxy de "/public" para localhost:4000 (vite.config.ts), então o
// caminho relativo funciona sem configurar nada. Em produção, o frontend é publicado
// separado da API — defina VITE_API_URL (ex: https://forms-madm-api.onrender.com) no
// build do site para apontar para o domínio real da API.
const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export const publicApi = axios.create({ baseURL: `${apiBaseUrl}/public/collections` });

export interface ApiErrorShape {
  error?: { code: string; message: string };
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: ApiErrorShape } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}
