import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { publicApi, extractErrorMessage } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { ItemCard } from "./ItemCard";
import { MultiItemCard } from "./MultiItemCard";
import { PDF_MULTI_TYPES, type ClientCollection as ClientCollectionData, type ClientMedia } from "./types";

type Stage = "loading" | "error" | "intro" | "checklist" | "completed";

export function ClientCollection() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>("loading");
  const [data, setData] = useState<ClientCollectionData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicApi
      .get<ClientCollectionData>(`/${token}`)
      .then((res) => {
        setData(res.data);
        setStage(res.data.status === "COMPLETED" ? "completed" : "intro");
      })
      .catch((err) => {
        setErrorMessage(extractErrorMessage(err, "Não foi possível abrir sua coleta."));
        setStage("error");
      });
  }, [token]);

  function handleUploaded(itemId: string, collectionStatus: string, media?: ClientMedia) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId
                ? { ...i, status: "UPLOADED", media: media ? [...i.media, media] : i.media }
                : i
            ),
          }
        : prev
    );
    if (collectionStatus === "COMPLETED") {
      setStage("completed");
    }
  }

  async function handleFinalize() {
    if (!data) return;
    const pending = data.items.some((i) => i.required && i.status !== "UPLOADED");
    if (pending) {
      setShowMissing(true);
      return;
    }
    setFinalizing(true);
    setErrorMessage("");
    try {
      const { data: resp } = await publicApi.post(`/${token}/finish`);
      if (resp.collectionStatus === "COMPLETED") {
        setStage("completed");
      }
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, "Não conseguimos finalizar seu envio. Tente novamente."));
    } finally {
      setFinalizing(false);
    }
  }

  if (stage === "loading") {
    return (
      <Shell>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </Shell>
    );
  }

  if (stage === "error") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">Não conseguimos abrir sua coleta</p>
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      </Shell>
    );
  }

  if (!data) return null;

  const done = data.items.filter((i) => i.status === "UPLOADED").length;
  const total = data.items.length;
  const allSent = done === total;

  if (stage === "completed") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-10 text-center animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Tudo certo, {data.client.name.split(" ")[0]}!</h1>
          <p className="max-w-xs text-sm text-slate-500">
            Recebemos todos os seus documentos. Nossa equipe já vai dar continuidade ao seu atendimento.
          </p>
        </div>
      </Shell>
    );
  }

  if (stage === "intro") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-5 py-8 text-center animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <Sparkles className="h-8 w-8 text-brand-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Vamos começar</h1>
            <p className="mx-auto max-w-xs text-slate-500">
              Olá, {data.client.name.split(" ")[0]}. Precisamos de alguns documentos e informações para concluir
              seu atendimento. Leva menos de 5 minutos.
            </p>
          </div>
          <Button size="lg" className="w-full max-w-xs" onClick={() => setStage("checklist")}>
            Começar
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Seus dados são tratados com segurança e sigilo.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-slate-900">Documentação</h1>
          <p className="text-sm text-slate-500">
            {allSent
              ? "Tudo enviado! Estamos finalizando seu atendimento."
              : "Envie cada item abaixo. Você pode tirar uma foto na hora ou escolher da galeria."}
          </p>
          <div className="flex items-center gap-3">
            <ProgressBar value={done} total={total} className="flex-1" />
            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
              {done}/{total}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {data.items.map((item, idx) => {
            const missing = showMissing && item.required && item.status !== "UPLOADED";
            return (
              <div key={item.id}>
                {item.type === "CTPS" && (
                  <p className="mb-3 mt-2 text-sm font-bold text-slate-900">Documentos do GOV</p>
                )}
                {item.type === "PPP" && (
                  <p className="mb-3 mt-2 text-sm font-bold text-slate-900">Doença Ocupacional</p>
                )}
                {item.multiple && PDF_MULTI_TYPES.has(item.type) ? (
                  <MultiItemCard token={token!} item={item} index={idx} onUploaded={handleUploaded} missing={missing} />
                ) : (
                  <ItemCard token={token!} item={item} index={idx} onUploaded={handleUploaded} missing={missing} />
                )}
              </div>
            );
          })}
        </div>

        {showMissing && !errorMessage && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Faltam itens obrigatórios (destacados em vermelho acima).
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</div>
        )}

        <Button size="lg" className="w-full" onClick={handleFinalize} disabled={finalizing}>
          {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Finalizar Envio
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
        <header className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            M
          </div>
          <span className="font-semibold text-slate-700">MADM</span>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-8 text-center text-xs text-slate-400">
          Conexão segura · Seus documentos são protegidos
        </footer>
      </div>
    </div>
  );
}
