import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Users, Video } from "lucide-react";
import { agentApi } from "../../lib/videoApi";
import { getAgentSession, clearAgentSession } from "../../lib/agentAuth";

interface AgentCollectionSummary {
  id: string;
  status: string;
  clientName: string;
  updatedAt: string;
  approvedCount: number;
  totalCount: number;
}

export function AgentDashboard() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<AgentCollectionSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAgentSession()) {
      navigate("/painel/login");
      return;
    }
    agentApi
      .get("/collections")
      .then((res) => setCollections(res.data.collections))
      .catch(() => {
        clearAgentSession();
        navigate("/painel/login");
      });
  }, [navigate]);

  function handleLogout() {
    clearAgentSession();
    navigate("/painel/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            M
          </div>
          <span className="font-semibold text-slate-700">Painel de atendimento</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Atendimentos ativos</h1>
        <p className="mb-6 text-sm text-slate-500">Escolha um cliente para entrar na sala de atendimento.</p>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {!collections && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}

        {collections?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-14 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum atendimento ativo no momento.</p>
          </div>
        )}

        <div className="space-y-3">
          {collections?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/painel/atendimento/${c.id}`)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-soft transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Video className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{c.clientName}</p>
                <p className="text-sm text-slate-500">
                  {c.approvedCount}/{c.totalCount} documentos aprovados
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {c.status}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
