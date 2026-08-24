import { CheckCircle2, Share2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { CollectionProgress } from "./CollectionProgress";
import { DocumentCard } from "./DocumentCard";
import type { AgentCollection } from "../types";

interface DocumentPanelProps {
  collection: AgentCollection;
  onApprove: (itemId: string) => Promise<void>;
  onReject: (itemId: string, reason: string) => Promise<void>;
  onFinalize: () => void;
  finalizing: boolean;
  onShare?: () => void;
}

export function DocumentPanel({ collection, onApprove, onReject, onFinalize, finalizing, onShare }: DocumentPanelProps) {
  const approved = collection.items.filter((i) => i.status === "APPROVED").length;
  const total = collection.items.length;
  const requiredPending = collection.items.some((i) => i.required && i.status !== "APPROVED");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cliente</p>
            <p className="text-lg font-bold text-slate-900">{collection.client.name}</p>
          </div>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
          )}
        </div>
        <div className="mt-3">
          <CollectionProgress approved={approved} total={total} />
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {collection.items.map((item) => (
          <DocumentCard key={item.id} item={item} onApprove={onApprove} onReject={onReject} />
        ))}
      </div>

      <div className="border-t border-slate-100 p-4">
        <Button size="lg" className="w-full" onClick={onFinalize} disabled={requiredPending || finalizing}>
          <CheckCircle2 className="h-4 w-4" /> Finalizar documentação
        </Button>
      </div>
    </div>
  );
}
