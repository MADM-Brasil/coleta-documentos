import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Clock, Copy, ExternalLink, Share2, ShieldCheck } from "lucide-react";
import { watchApi, extractErrorMessage } from "../../lib/api";
import { ConsultantItemCard } from "./ConsultantItemCard";
import type { WatchCollection, WatchItem } from "./types";
import { mockWatchCollection } from "../demo/mockData";

const POLL_INTERVAL_MS = 4000;

export function ConsultantWatch() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<WatchCollection | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    // Rota de demonstração (sem depender do banco/API) — só pra visualizar o layout.
    if (token === "demo") {
      setData((prev) => prev ?? mockWatchCollection);
      setLoading(false);
      return;
    }
    try {
      const res = await watchApi.get<WatchCollection>(`/${token}`);
      setData(res.data);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, "Não foi possível carregar o acompanhamento."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  function handleReviewed(itemId: string, status: WatchItem["status"], reviewNote: string | null) {
    setData((prev) =>
      prev
        ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, status, reviewNote } : i)) }
        : prev
    );
  }

  function handleCopy() {
    if (!data?.clientLink) return;
    navigator.clipboard.writeText(data.clientLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading && !data) {
    return (
      <Shell>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </Shell>
    );
  }

  if (errorMessage && !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">Não conseguimos abrir o acompanhamento</p>
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      </Shell>
    );
  }

  if (!data) return null;

  const done = data.items.filter((i) => i.status === "APPROVED").length;
  const total = data.items.length;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{data.client.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{done}/{total} aprovados</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Link expira em {new Date(data.expiresAt).toLocaleDateString("pt-BR")}
            </span>
          </p>
        </div>

        {data.clientLink && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShareOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </button>

            {shareOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                <p className="mb-2 text-sm font-semibold text-slate-900">Link para enviar ao cliente</p>
                <p className="mb-3 truncate rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  {data.clientLink}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                  <a
                    href={data.clientLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" /> Abrir
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.items.map((item, idx) => (
          <ConsultantItemCard key={item.id} token={token!} item={item} index={idx} onReviewed={handleReviewed} />
        ))}
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-center gap-2">
          <img src="/favicon.png" alt="MADM" className="h-9 w-9 rounded-lg object-cover" />
          <span className="font-semibold text-slate-700">MADM · Acompanhamento</span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
