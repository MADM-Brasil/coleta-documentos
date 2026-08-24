import { useRef, useState } from "react";
import { Check, FileText, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { publicApi, extractErrorMessage } from "../../lib/api";
import type { ClientItem, ClientMedia } from "./types";

interface MultiItemCardProps {
  token: string;
  item: ClientItem;
  index: number;
  onUploaded: (itemId: string, collectionStatus: string, media: ClientMedia) => void;
  missing?: boolean;
}

export function MultiItemCard({ token, item, index, onUploaded, missing }: MultiItemCardProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const done = item.status === "UPLOADED" || item.status === "APPROVED";

  async function handleFileSelected(selected: FileList | null) {
    const file = selected?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await publicApi.post(`/${token}/items/${item.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      onUploaded(item.id, data.collectionStatus, data.media);
    } catch (err) {
      setError(extractErrorMessage(err, "Não conseguimos enviar o arquivo. Verifique se é um PDF e tente novamente."));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left active:bg-slate-50"
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            done ? "bg-emerald-100 text-emerald-600" : "bg-brand-50 text-brand-600"
          }`}
        >
          {done ? <Check className="h-6 w-6" strokeWidth={2.5} /> : <FileText className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{item.title}</p>
          <p className="truncate text-sm text-slate-500">
            {item.media.length > 0
              ? `${item.media.length} arquivo${item.media.length > 1 ? "s" : ""} enviado${item.media.length > 1 ? "s" : ""}`
              : item.description}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            missing ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {item.media.length > 0 ? "Adicionar" : "Enviar"}
        </span>
      </button>

      {item.status === "REJECTED" && item.rejectionReason && (
        <div className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">Precisamos que você envie novamente.</p>
          <p className="text-red-600">Motivo: {item.rejectionReason}</p>
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 p-4 animate-fade-in">
          {item.instructions && (
            <div className="mb-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{item.instructions}</div>
          )}

          {item.media.length > 0 && (
            <ul className="mb-3 space-y-2">
              {item.media.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="truncate">{m.originalFilename}</span>
                </li>
              ))}
            </ul>
          )}

          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                Enviando... {progress}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-6">
              <FileText className="h-6 w-6 text-brand-600" />
              <Button size="md" onClick={() => fileInputRef.current?.click()}>
                Escolher arquivo PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files)}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-slate-400"
          >
            <X className="h-3.5 w-3.5" /> Fechar
          </button>
        </div>
      )}
    </div>
  );
}
