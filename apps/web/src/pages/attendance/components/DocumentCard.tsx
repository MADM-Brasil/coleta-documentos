import { useEffect, useState } from "react";
import { Check, Clock, Eye, Mic, RotateCcw, ShieldAlert, Loader2, Square, Video, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import type { AgentItem } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

// Motivos pré-definidos pra recusar, separados por tipo de item — foto, vídeo, áudio e
// documentos em PDF têm problemas bem diferentes entre si.
const PHOTO_REASONS = [
  "Foto cortada/incompleta",
  "Foto borrada/fora de foco",
  "Documento ilegível",
  "Foto muito escura",
  "Reflexo/brilho cobrindo o documento",
  "Documento errado enviado",
];
const VIDEO_REASONS = [
  "Vídeo cortado/incompleto",
  "Movimento não aparece com clareza",
  "Vídeo escuro ou com baixa qualidade",
  "Ângulo não mostra o que foi pedido",
  "Vídeo não corresponde ao solicitado",
];
const AUDIO_REASONS = [
  "Áudio cortado/incompleto",
  "Áudio muito baixo/inaudível",
  "Muito ruído de fundo",
  "Conteúdo não corresponde ao solicitado",
];
const PDF_REASONS = [
  "Arquivo corrompido/não abre",
  "Documento incompleto",
  "Faltam páginas",
  "Documento errado enviado",
  "Baixa qualidade/ilegível",
];

function reasonOptionsFor(type: string): string[] {
  if (type === "VIDEO") return VIDEO_REASONS;
  if (type === "AUDIO") return AUDIO_REASONS;
  if (type === "RG_FRENTE" || type === "RG_VERSO" || type === "COMPROVANTE") return PHOTO_REASONS;
  return PDF_REASONS;
}

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
  isRecordingCapture?: boolean;
  isUploadingCapture?: boolean;
  captureCountdown?: number | null;
  onStartCapture?: () => void;
  onCancelCapture?: () => void;
  onStopCapture?: () => void;
}

export function DocumentCard({
  item,
  onApprove,
  onReject,
  isRecordingCapture,
  isUploadingCapture,
  captureCountdown,
  onStartCapture,
  onCancelCapture,
  onStopCapture,
}: DocumentCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // O botão de gravar fica escondido até o consultor clicar no card — evita poluir
  // a lista com um botão de gravação por item o tempo todo.
  const [captureOpen, setCaptureOpen] = useState(false);

  const media = item.media[item.media.length - 1];
  const canReview = item.status === "UPLOADED";
  const mediaUrl = media ? media.url ?? `${apiBaseUrl}/webhook/media/${media.id}` : null;
  const isVideoItem = item.type === "VIDEO";
  const canRecordCapture =
    (item.type === "AUDIO" || item.type === "VIDEO") &&
    // Itens "multiple" continuam permitindo gravar de novo mesmo já com um arquivo
    // em análise/aprovado — o consultor pode registrar mais de um vídeo/áudio.
    (item.status === "PENDING" || item.status === "REJECTED" || item.multiple) &&
    !isUploadingCapture &&
    onStartCapture;

  const isCountingDown = isRecordingCapture && !!captureCountdown;
  const [recordSeconds, setRecordSeconds] = useState(0);
  useEffect(() => {
    if (!isRecordingCapture || isCountingDown) {
      setRecordSeconds(0);
      return;
    }
    const interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecordingCapture, isCountingDown]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

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
      setCustomReason(false);
    } finally {
      setBusy(false);
    }
  }

  // Enquanto está gravando/enviando, o painel fica sempre visível mesmo que o
  // consultor não tenha clicado no card (ou tenha clicado de novo sem querer).
  const captureVisible = captureOpen || isRecordingCapture || isUploadingCapture;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft">
      <button
        type="button"
        onClick={() => canRecordCapture && setCaptureOpen((v) => !v)}
        className={`flex w-full items-start justify-between gap-3 text-left ${canRecordCapture ? "cursor-pointer" : "cursor-default"}`}
      >
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
      </button>

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

      {captureVisible && isCountingDown && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <span className="text-sm font-medium text-red-700">
            Começando em {captureCountdown}... (veja o vídeo da chamada)
          </span>
          <button
            type="button"
            onClick={onCancelCapture}
            aria-label="Cancelar"
            title="Cancelar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-red-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {captureVisible && isRecordingCapture && !isCountingDown && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-red-700">
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-red-600" />
            </span>
            Gravando o {isVideoItem ? "vídeo" : "áudio"} do cliente... {formatTime(recordSeconds)}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onCancelCapture}
              aria-label="Cancelar gravação"
              title="Cancelar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onStopCapture}
              aria-label="Parar e enviar"
              title="Parar e enviar"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {captureVisible && isUploadingCapture && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
          <span className="text-sm font-medium text-brand-700">
            Enviando {isVideoItem ? "vídeo" : "áudio"}... {isVideoItem ? "(convertendo, pode levar alguns segundos)" : ""}
          </span>
        </div>
      )}

      {captureVisible && !isRecordingCapture && canRecordCapture && (
        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onStartCapture}>
          {isVideoItem ? <Video className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          Gravar {isVideoItem ? "vídeo" : "áudio"} do cliente
        </Button>
      )}

      {canReview && !rejecting && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleApprove} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setRejecting(true);
              setReason("");
              setCustomReason(false);
            }}
            disabled={busy}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Solicitar novamente
          </Button>
        </div>
      )}

      {canReview && rejecting && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-1.5">
            {reasonOptionsFor(item.type).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setReason(option);
                  setCustomReason(false);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  !customReason && reason === option
                    ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                    : "border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/50"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomReason(true);
                setReason("");
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                customReason
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/50"
              }`}
            >
              Outro motivo...
            </button>
          </div>

          {customReason && (
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setRejecting(false);
                setReason("");
                setCustomReason(false);
              }}
            >
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
