const STORAGE_KEY = "madm_agent_session";

export function getAgentSession(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAgentSession(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* navegador pode bloquear localStorage (modo privado) — sessão só dura a aba atual */
  }
}

export function clearAgentSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}
