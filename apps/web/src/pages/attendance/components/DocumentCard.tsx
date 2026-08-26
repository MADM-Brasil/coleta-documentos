import { useState } from "react";
import { Check, Clock, Eye, Mic, RotateCcw, ShieldAlert, Loader2, Square, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import type { AgentItem } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

const STATUS_LABEL: Record<AgentItem["status"], string> = {
  PENDING: "Pendente",
  UPLOADED: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Enviar novamente",
};

const STATUS_STYLE: Record<AgentItem["status"], string> = {
  PENDING: "bg-slate-100 text-slate-600",
  UPLOADED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

interface DocumentCardProps {
  item: AgentItem;
  onApprove: (itemId: string) => Promise<void>;
  onReject: (itemId: string, reason: string) => Promise<void>;
  isRecordingAudio?: boolean;
  onStartAudioCapture?: () => void;
  onCancelAudioCapture?: () => void;
  onStopAudioCapture?: () => void;
}

export function DocumentCard({
  item,
  onApprove,
  onReject,
  isRecordingAudio,
  onStartAudioCapture,
  onCancelAudioCapture,
  onStopAudioCapture,
}: DocumentCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const media = item.media[item.media.length - 1];
  const canReview = item.status === "UPLOADED";
  const mediaUrl = media ? media.url ?? `${apiBaseUrl}/webhook/media/${media.id}` : null;
  const canRecordAudio =
    item.type === "AUDIO" && (item.status === "PENDING" || item.status === "REJECTED") && onStartAudioCapture;

  async function handleApprove() {
    setBusy(true);
    try {
      await onApprove(item.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onReject(item.id, reason.trim());
      setRejecting(false);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
          {item.status === "REJECTED" && item.rejectionReason && (
            <p className="mt-0.5 truncate text-xs text-red-600">Motivo: {item.rejectionReason}</p>
          )}
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
          {item.status === "APPROVED" && <Check className="h-3 w-3" />}
          {item.status === "UPLOADED" && <Clock className="h-3 w-3" />}
          {item.status === "REJECTED" && <ShieldAlert className="h-3 w-3" />}
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      {media && mediaUrl && (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <Eye className="h-3.5 w-3.5" /> Visualizar
        </button>
      )}

      {previewOpen && media && mediaUrl && (
        <DocumentPreviewModal
          url={mediaUrl}
          mimeType={media.mimeType}
          filename={media.originalFilename}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {isRecordingAudio && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-red-700">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-red-600" /> Gravando o áudio do cliente...
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onCancelAudioCapture}
              aria-label="Cancelar gravação"
              title="Cancelar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onStopAudioCapture}
              aria-label="Parar e enviar"
              title="Parar e enviar"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {!isRecordingAudio && canRecordAudio && (
        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onStartAudioCapture}>
          <Mic className="h-3.5 w-3.5" /> Gravar áudio do cliente
        </Button>
      )}

      {canReview && !rejecting && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleApprove} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>
            <RotateCcw className="h-3.5 w-3.5" /> Solicitar novamente
          </Button>
        </div>
      )}

      {canReview && rejecting && (
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (ex: imagem cortada)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="danger" className="flex-1" onClick={handleReject} disabled={!reason.trim() || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enviar solicitação
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
