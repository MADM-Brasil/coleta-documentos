import { useState } from "react";
import { AlertCircle, Check, Clock, FileText, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { watchApi, extractErrorMessage } from "../../lib/api";
import type { WatchItem } from "./types";

interface ConsultantItemCardProps {
  token: string;
  item: WatchItem;
  index: number;
  onReviewed: (itemId: string, status: WatchItem["status"], reviewNote: string | null) => void;
}

export function ConsultantItemCard({ token, item, index, onReviewed }: ConsultantItemCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  function handleImageError(mediaId: string) {
    setBrokenImages((prev) => ({ ...prev, [mediaId]: true }));
  }

  const approved = item.status === "APPROVED";
  const inReview = item.status === "UPLOADED";
  const rejected = item.status === "REJECTED";
  const pending = item.status === "PENDING";

  async function handleReview(action: "approve" | "reject") {
    setSubmitting(true);
    setError(null);
    // Rota de demonstração (sem depender do banco/API) — só pra visualizar o layout.
    if (token === "demo") {
      onReviewed(item.id, action === "approve" ? "APPROVED" : "REJECTED", action === "reject" ? reason || null : null);
      setSubmitting(false);
      setRejecting(false);
      setReason("");
      return;
    }
    try {
      const { data } = await watchApi.post(`/${token}/items/${item.id}/review`, {
        action,
        reason: action === "reject" ? reason || undefined : undefined,
      });
      onReviewed(item.id, data.status, data.reviewNote);
      setRejecting(false);
      setReason("");
    } catch (err) {
      setError(extractErrorMessage(err, "Não foi possível registrar a análise."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`animate-slide-up flex flex-col overflow-hidden rounded-2xl border bg-white shadow-soft transition-all ${
        approved ? "border-emerald-200" : rejected ? "border-red-300" : inReview ? "border-amber-200" : "border-slate-200"
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            approved
              ? "bg-emerald-100 text-emerald-600"
              : rejected
                ? "bg-red-100 text-red-600"
                : inReview
                  ? "bg-amber-100 text-amber-600"
                  : "bg-slate-100 text-slate-400"
          }`}
        >
          {approved ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : rejected ? (
            <AlertCircle className="h-5 w-5" />
          ) : inReview ? (
            <Clock className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{item.title}</p>
          <span
            className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              approved
                ? "bg-emerald-100 text-emerald-700"
                : rejected
                  ? "bg-red-100 text-red-700"
                  : inReview
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
            }`}
          >
            {approved ? "Aprovado" : rejected ? "Reprovado" : inReview ? "Em análise" : "Pendente"}
          </span>
        </div>
      </div>

      <div className="flex-1 border-t border-slate-100 p-4">
        {pending && <p className="text-sm text-slate-400">Aguardando envio do cliente.</p>}

        {item.media.length > 0 && (
          <ul className="space-y-2">
            {item.media.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-xl border border-slate-100">
                {m.url && m.mimeType.startsWith("image/") && !brokenImages[m.id] ? (
                  <a href={m.url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={m.url}
                      alt=""
                      className="h-32 w-full bg-slate-50 object-cover"
                      onError={() => handleImageError(m.id)}
                    />
                    <span className="block truncate px-2.5 py-1.5 text-xs text-slate-500">{m.originalFilename}</span>
                  </a>
                ) : m.url && m.mimeType.startsWith("video/") ? (
                  <>
                    <video src={m.url} controls className="h-32 w-full bg-black object-cover" />
                    <span className="block truncate px-2.5 py-1.5 text-xs text-slate-500">{m.originalFilename}</span>
                  </>
                ) : m.url && m.mimeType.startsWith("audio/") ? (
                  <div className="space-y-1.5 p-2.5">
                    <audio src={m.url} controls className="w-full" />
                    <span className="block truncate text-xs text-slate-500">{m.originalFilename}</span>
                  </div>
                ) : (
                  <a
                    href={m.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-3 text-sm text-brand-700 hover:bg-brand-50"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{m.originalFilename}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {rejected && (
          <p className="mt-2 text-sm text-red-600">{item.reviewNote ? `Motivo: ${item.reviewNote}` : "Reprovado."}</p>
        )}

        {error && <div className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</div>}
      </div>

      {inReview && (
        <div className="border-t border-slate-100 p-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da reprovação (opcional)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setRejecting(false)}
                  disabled={submitting}
                >
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleReview("reject")}
                  loading={submitting}
                >
                  Confirmar reprovação
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setRejecting(true)}
                disabled={submitting}
              >
                Reprovar
              </Button>
              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleReview("approve")} loading={submitting}>
                Aprovar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
