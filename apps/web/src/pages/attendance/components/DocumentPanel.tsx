import { CheckCircle2 } from "lucide-react";
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
}

export function DocumentPanel({ collection, onApprove, onReject, onFinalize, finalizing }: DocumentPanelProps) {
  const approved = collection.items.filter((i) => i.status === "APPROVED").length;
  const total = collection.items.length;
  const requiredPending = collection.items.some((i) => i.required && i.status !== "APPROVED");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cliente</p>
        <p className="text-lg font-bold text-slate-900">{collection.client.name}</p>
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
