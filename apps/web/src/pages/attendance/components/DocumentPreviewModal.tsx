import { useState } from "react";
import { FileText, X } from "lucide-react";

interface DocumentPreviewModalProps {
  url: string;
  mimeType: string;
  filename: string;
  onClose: () => void;
}

// Preview dentro da própria página — nunca abre em nova aba/navegação, porque isso
// derrubava a chamada de vídeo (WebRTC fica atrelado à página atual). Clicar na imagem
// alterna entre um tamanho médio e um tamanho grande, sem sair do modal.
export function DocumentPreviewModal({ url, mimeType, filename, onClose }: DocumentPreviewModalProps) {
  const [expanded, setExpanded] = useState(false);
  // Alguns navegadores/uploads (ex: gravação via MediaRecorder) podem salvar o mimeType
  // com sufixo de codec ("video/webm;codecs=vp8,opus") ou, em casos raros, sem tipo
  // reconhecível — nesses casos cai pra extensão do próprio nome do arquivo.
  const type = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isVideo = type.startsWith("video/") || ["webm", "mp4", "mov"].includes(ext);
  const isAudio = type.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext);
  const isPdf = type.includes("pdf") || ext === "pdf";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all ${
          expanded ? "h-[90vh] w-[95vw]" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-700">{filename}</p>
          <button type="button" onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-50 p-2">
          {isImage && (
            <img
              src={url}
              alt={filename}
              onClick={() => setExpanded((v) => !v)}
              className={`cursor-zoom-in rounded-lg object-contain ${expanded ? "h-full w-full" : "max-h-[70vh] max-w-full"}`}
            />
          )}
          {isVideo && <video src={url} controls className="max-h-[75vh] max-w-full rounded-lg" />}
          {isAudio && <audio src={url} controls className="w-full" />}
          {isPdf && <iframe src={url} title={filename} className="h-[75vh] w-full rounded-lg border-0" />}
          {!isImage && !isVideo && !isAudio && !isPdf && (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Pré-visualização não disponível para este tipo de arquivo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
