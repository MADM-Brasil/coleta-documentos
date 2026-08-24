import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  FileImage,
  FileText,
  IdCard,
  ImagePlus,
  Loader2,
  Mic,
  RefreshCw,
  Square,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { publicApi, extractErrorMessage } from "../../lib/api";
import type { ClientItem } from "./types";

const ICONS: Record<ClientItem["type"], typeof IdCard> = {
  RG_FRENTE: IdCard,
  RG_VERSO: IdCard,
  COMPROVANTE: FileImage,
  AUDIO: Mic,
  VIDEO: Video,
  CTPS: FileText,
  CNIS: FileText,
  LAUDO_MEDICO: FileText,
  CARTA_CONCESSAO: FileText,
  COPIA_PROCESSO: FileText,
  CAT: FileText,
};

const isVideoType = (type: ClientItem["type"]) => type === "VIDEO";
const isAudioType = (type: ClientItem["type"]) => type === "AUDIO";
const isPdfOnlyType = (type: ClientItem["type"]) => type === "CNIS";

interface ItemCardProps {
  token: string;
  item: ClientItem;
  index: number;
  onUploaded: (itemId: string, collectionStatus: string) => void;
  missing?: boolean;
}

export function ItemCard({ token, item, index, onUploaded, missing }: ItemCardProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const Icon = ICONS[item.type];
  const done = item.status === "UPLOADED" || item.status === "APPROVED";
  const video = isVideoType(item.type);
  const audio = isAudioType(item.type);
  const pdfOnly = isPdfOnlyType(item.type);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function handleFileSelected(selected: FileList | null) {
    const picked = selected?.[0];
    if (!picked) return;
    setError(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const recordedFile = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
        setFile(recordedFile);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError("Não conseguimos acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function handleConfirm() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await publicApi.post(`/${token}/items/${item.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      onUploaded(item.id, data.collectionStatus);
      setOpen(false);
      reset();
    } catch (err) {
      setError(extractErrorMessage(err, "Não conseguimos enviar seu documento. Verifique sua conexão e tente novamente."));
    } finally {
      setUploading(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div
      className={`animate-slide-up overflow-hidden rounded-2xl border bg-white shadow-soft transition-all ${
        done ? "border-emerald-200" : missing ? "border-red-300" : "border-slate-200"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        type="button"
        onClick={() => !done && setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left active:bg-slate-50"
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            done ? "bg-emerald-100 text-emerald-600" : "bg-brand-50 text-brand-600"
          }`}
        >
          {done ? <Check className="h-6 w-6" strokeWidth={2.5} /> : <Icon className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{item.title}</p>
          <p className="truncate text-sm text-slate-500">{done ? "Enviado com sucesso" : item.description}</p>
        </div>
        {!done && (
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              item.status === "REJECTED"
                ? "bg-red-100 text-red-700"
                : missing
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {item.status === "REJECTED" ? "Enviar novamente" : "Enviar"}
          </span>
        )}
      </button>

      {item.status === "REJECTED" && item.rejectionReason && (
        <div className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">Precisamos que você envie novamente.</p>
          <p className="text-red-600">Motivo: {item.rejectionReason}</p>
        </div>
      )}

      {open && !done && (
        <div className="border-t border-slate-100 p-4 animate-fade-in">
          {item.instructions && (
            <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{item.instructions}</div>
          )}

          {!previewUrl && audio && (
            <div className="flex flex-col items-center gap-3 py-4">
              {recording ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                    <Mic className="h-8 w-8 animate-pulse text-red-600" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{formatTime(recordSeconds)}</p>
                  <Button variant="danger" size="md" onClick={stopRecording}>
                    <Square className="h-4 w-4" /> Parar gravação
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition-transform active:scale-95"
                  >
                    <Mic className="h-8 w-8" />
                  </button>
                  <p className="text-sm text-slate-500">Toque para começar a gravar</p>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="text-xs font-medium text-brand-600 underline"
                  >
                    ou escolher um arquivo de áudio já gravado
                  </button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files)}
                  />
                </>
              )}
            </div>
          )}

          {!previewUrl && !audio && pdfOnly && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-6">
              <FileText className="h-6 w-6 text-brand-600" />
              <Button size="md" onClick={() => galleryInputRef.current?.click()}>
                Escolher arquivo PDF
              </Button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files)}
              />
            </div>
          )}

          {!previewUrl && !audio && !pdfOnly && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 py-5 text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 active:scale-[0.98]"
              >
                <Camera className="h-6 w-6 text-brand-600" />
                <span className="text-sm font-medium">{video ? "Gravar vídeo" : "Tirar foto"}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 py-5 text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 active:scale-[0.98]"
              >
                <ImagePlus className="h-6 w-6 text-brand-600" />
                <span className="text-sm font-medium">{video ? "Escolher vídeo" : "Escolher da galeria"}</span>
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept={video ? "video/*" : "image/*"}
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files)}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept={video ? "video/*" : "image/*,application/pdf"}
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files)}
              />
            </div>
          )}

          {previewUrl && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl bg-slate-100">
                {audio ? (
                  <div className="flex items-center justify-center p-6">
                    <audio src={previewUrl} controls className="w-full" />
                  </div>
                ) : video ? (
                  <video src={previewUrl} controls className="max-h-72 w-full" />
                ) : pdfOnly ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-slate-700">
                    <FileText className="h-5 w-5 shrink-0 text-brand-600" />
                    <span className="truncate">{file?.name}</span>
                  </div>
                ) : (
                  <img src={previewUrl} alt="Pré-visualização" className="max-h-72 w-full object-contain" />
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              )}

              {uploading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    Enviando... {progress}%
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="md" className="flex-1" onClick={reset}>
                    <RefreshCw className="h-4 w-4" /> Refazer
                  </Button>
                  <Button size="md" className="flex-1" onClick={handleConfirm}>
                    <Upload className="h-4 w-4" /> Confirmar e enviar
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && !previewUrl && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {!previewUrl && !recording && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-slate-400"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
