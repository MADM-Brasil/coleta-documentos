import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { agentApi } from "../../lib/videoApi";
import { setAgentSession } from "../../lib/agentAuth";
import { extractErrorMessage } from "../../lib/api";

export function AgentLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Ex: Make manda o consultor direto pra uma sala específica (/painel/atendimento/:id) —
  // se ele ainda não tiver logado, volta pra ela depois do login em vez da lista geral.
  const next = searchParams.get("next") || "/painel";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Só aparece se a tentativa automática (abaixo) falhar — em uso normal, com o
  // login exigido pelo servidor, isso acontece imediatamente e a tela nem pisca.
  const [checkingAuto, setCheckingAuto] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Se DISABLE_AGENT_AUTH estiver ligado no servidor (só pra demonstração), o
    // login aceita qualquer coisa — essa tentativa silenciosa entra direto sem
    // mostrar a tela de senha pra ninguém.
    agentApi
      .post("/login", { password: "" })
      .then(({ data }) => {
        if (cancelled) return;
        setAgentSession(data.token);
        navigate(next);
      })
      .catch(() => {
        if (!cancelled) setCheckingAuto(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await agentApi.post("/login", { password });
      setAgentSession(data.token);
      navigate(next);
    } catch (err) {
      setError(extractErrorMessage(err, "Não foi possível entrar. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuto) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Painel do consultor</h1>
            <p className="text-sm text-slate-500">Entre com a senha da equipe.</p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <Button type="submit" size="lg" className="w-full" disabled={loading || !password}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
      </form>
    </div>
  );
}
