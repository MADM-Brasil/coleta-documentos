import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut, Plus, Share2, Users, Video } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { agentApi } from "../../lib/videoApi";
import { getAgentSession, clearAgentSession } from "../../lib/agentAuth";
import { ShareLinkModal } from "./ShareLinkModal";

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
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<{ clientName: string; link: string } | null>(null);

  function loadCollections() {
    agentApi
      .get("/collections")
      .then((res) => setCollections(res.data.collections))
      .catch(() => {
        clearAgentSession();
        navigate("/painel/login");
      });
  }

  useEffect(() => {
    if (!getAgentSession()) {
      navigate("/painel/login");
      return;
    }
    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  function handleLogout() {
    clearAgentSession();
    navigate("/painel/login");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data } = await agentApi.post("/collections", { name: newName.trim() });
      setShare({ clientName: newName.trim(), link: data.clientLink });
      setNewName("");
      setCreating(false);
      loadCollections();
    } catch {
      setError("Não foi possível criar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare(c: AgentCollectionSummary) {
    setBusy(true);
    try {
      const { data } = await agentApi.post(`/collections/${c.id}/relink`);
      setShare({ clientName: c.clientName, link: data.clientLink });
    } catch {
      setError("Não foi possível gerar o link.");
    } finally {
      setBusy(false);
    }
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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-xl font-bold text-slate-900">Atendimentos ativos</h1>
            <p className="text-sm text-slate-500">Crie uma sessão nova ou entre em um atendimento existente.</p>
          </div>
          <Button size="md" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" /> Nova sessão
          </Button>
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="mb-6 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do cliente"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button type="submit" size="md" disabled={!newName.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </form>
        )}

        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

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
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-colors hover:border-brand-300"
            >
              <button
                type="button"
                onClick={() => navigate(`/painel/atendimento/${c.id}`)}
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
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
              </button>
              <button
                type="button"
                onClick={() => handleShare(c)}
                disabled={busy}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Share2 className="h-3.5 w-3.5" /> Compartilhar
              </button>
            </div>
          ))}
        </div>
      </main>

      {share && <ShareLinkModal clientName={share.clientName} link={share.link} onClose={() => setShare(null)} />}
    </div>
  );
}
