import { useState } from "react";
import { Loader2, Video, X } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface NewRoomModalProps {
  onCreate: (clientName: string, agentName: string, externalId?: string) => Promise<void>;
  onClose: () => void;
}

export function NewRoomModal({ onCreate, onClose }: NewRoomModalProps) {
  const [clientName, setClientName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !agentName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(clientName.trim(), agentName.trim(), externalId.trim() || undefined);
    } catch {
      setError("Não foi possível criar a sala. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-slate-900">Nova sala</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Nome do cliente</label>
            <input
              autoFocus
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Digite o nome do cliente"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Nome do consultor</label>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Digite o nome do consultor"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              ID do lead <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="Ex: ID do lead na Kommo/HubSpot"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-slate-400">Se preenchido, os documentos enviados nessa sala já chegam identificados no Make.</p>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <Button type="submit" size="md" className="w-full" disabled={!clientName.trim() || !agentName.trim() || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Criar sala
          </Button>
        </form>
      </div>
    </div>
  );
}
