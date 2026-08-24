import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Headset, Loader2, LogOut, Radio, Share2, Video } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { agentApi } from "../../lib/videoApi";
import { getAgentSession, clearAgentSession } from "../../lib/agentAuth";
import { ShareLinkModal } from "./ShareLinkModal";

interface AgentCollectionSummary {
  id: string;
  status: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  approvedCount: number;
  totalCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  SENT: "Aguardando",
  OPENED: "Em andamento",
  IN_PROGRESS: "Em andamento",
};

const STATUS_DOT: Record<string, string> = {
  SENT: "bg-amber-400",
  OPENED: "bg-emerald-500",
  IN_PROGRESS: "bg-emerald-500",
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR")}, ${time}`;
}

export function AgentDashboard() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<AgentCollectionSummary[] | null>(null);
  const [error, setError] = useState("");
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

  const stats = useMemo(() => {
    const list = collections ?? [];
    return {
      active: list.length,
      today: list.filter((c) => isToday(c.createdAt)).length,
      pending: list.filter((c) => c.approvedCount < c.totalCount).length,
    };
  }, [collections]);

  function handleLogout() {
    clearAgentSession();
    navigate("/painel/login");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await agentApi.post("/collections", { name: newName.trim() });
      setShare({ clientName: newName.trim(), link: data.clientLink });
      setNewName("");
      loadCollections();
    } catch {
      setError("Não foi possível criar a sala. Tente novamente.");
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
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">MADM</p>
            <p className="text-xs text-slate-400">Atendimento assistido</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700">
            <Video className="h-4 w-4" /> Salas de atendimento
          </div>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Painel de Salas</h1>
        <p className="mb-6 text-sm text-slate-500">Gerencie salas de atendimento por videochamada com coleta de documentos.</p>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Radio} label="Salas ativas" value={stats.active} hint="Em andamento agora" tone="brand" />
          <StatCard icon={Headset} label="Atendimentos hoje" value={stats.today} hint="Salas criadas hoje" tone="emerald" />
          <StatCard icon={Clock} label="Pendentes" value={stats.pending} hint="Aguardando documentos" tone="amber" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="mb-4 font-semibold text-slate-900">Criar nova sala</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Nome do cliente</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Digite o nome do cliente"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <Button type="submit" size="md" className="w-full" disabled={!newName.trim() || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                Criar sala
              </Button>
            </form>
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="font-semibold text-slate-900">Salas criadas</p>
            </div>

            {!collections && (
              <div className="space-y-2 p-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            )}

            {collections?.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Video className="h-7 w-7 text-slate-300" />
                <p className="text-sm text-slate-500">Nenhuma sala ativa no momento.</p>
              </div>
            )}

            {collections && collections.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="px-5 py-2.5 font-medium">Cliente</th>
                      <th className="px-5 py-2.5 font-medium">Documentos</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Criada em</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c) => (
                      <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/painel/atendimento/${c.id}`)}
                            className="font-medium text-slate-900 hover:text-brand-600"
                          >
                            {c.clientName}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {c.approvedCount}/{c.totalCount}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`} />
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleShare(c)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <Share2 className="h-3.5 w-3.5" /> Compartilhar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {share && <ShareLinkModal clientName={share.clientName} link={share.link} onClose={() => setShare(null)} />}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Radio;
  label: string;
  value: number;
  hint: string;
  tone: "brand" | "emerald" | "amber";
}) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  }[tone];

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}
