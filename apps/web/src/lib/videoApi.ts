import axios from "axios";
import { getAgentSession } from "./agentAuth";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export const videoApi = axios.create({ baseURL: `${apiBaseUrl}/api/video` });
export const agentApi = axios.create({ baseURL: `${apiBaseUrl}/api/agent` });

// O consultor autentica uma vez (senha da equipe) e a sessão vale pra qualquer
// atendimento — sem precisar de token por coleta na URL.
videoApi.interceptors.request.use((config) => {
  const session = getAgentSession();
  if (session) config.headers.Authorization = `Bearer ${session}`;
  return config;
});
agentApi.interceptors.request.use((config) => {
  const session = getAgentSession();
  if (session) config.headers.Authorization = `Bearer ${session}`;
  return config;
});

export const realtimeUrl = apiBaseUrl || window.location.origin;
