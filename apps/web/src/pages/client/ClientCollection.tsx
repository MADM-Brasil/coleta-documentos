import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, HelpCircle, Loader2, Menu, ShieldCheck, Sparkles } from "lucide-react";
import { publicApi, extractErrorMessage } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { ItemCard } from "./ItemCard";
import { MultiItemCard } from "./MultiItemCard";
import type { ClientCollection as ClientCollectionData, ClientItem, ClientMedia } from "./types";
import { mockClientCollection } from "../demo/mockData";

type Stage = "loading" | "error" | "intro" | "checklist" | "completed";

interface Category {
  key: string;
  label: string;
  title: string;
  description: string;
  types: ClientItem["type"][];
}

const CATEGORIES: Category[] = [
  {
    key: "documentacao",
    label: "Documentação",
    title: "Documentação",
    description: "Envie os documentos básicos relacionados ao seu acidente.",
    types: ["RG_FRENTE", "RG_VERSO", "COMPROVANTE", "AUDIO", "VIDEO"],
  },
  {
    key: "gov",
    label: "GOV",
    title: "Documentos do GOV",
    description: "Envie os documentos relacionados a benefícios e vínculos governamentais.",
    types: ["CTPS", "CNIS", "LAUDO_MEDICO", "CARTA_CONCESSAO", "COPIA_PROCESSO", "CAT"],
  },
  {
    key: "ocupacional",
    label: "Doença Ocupacional",
    title: "Documentos de Doença Ocupacional",
    description: "Envie os documentos relacionados à sua doença ocupacional.",
    types: ["PPP", "HOLERITE_EPOCA", "TERMO_RESCISAO", "DOCUMENTO_CARGO", "COMPROVACAO_AFASTAMENTO"],
  },
];

export function ClientCollection() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>("loading");
  const [data, setData] = useState<ClientCollectionData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const stageRef = useRef<Stage>("loading");
  stageRef.current = stage;

  useEffect(() => {
    if (!token) return;
    // Rota de demonstração (sem depender do banco/API) — só pra visualizar o layout.
    if (token === "demo") {
      setData(mockClientCollection);
      setStage("intro");
      return;
    }
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

  // Enquanto o cliente está no checklist, busca o status a cada poucos segundos —
  // assim aprovações/reprovações do consultor aparecem sem precisar dar refresh.
  useEffect(() => {
    if (!token || token === "demo") return;
    const interval = setInterval(() => {
      if (stageRef.current !== "checklist") return;
      publicApi
        .get<ClientCollectionData>(`/${token}`)
        .then((res) => {
          setData(res.data);
          if (res.data.status === "COMPLETED") setStage("completed");
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  function handleUploaded(itemId: string, collectionStatus: string, media?: ClientMedia) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId
                ? { ...i, status: "UPLOADED", reviewNote: null, media: media ? [...i.media, media] : i.media }
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
    const firstPendingCategory = CATEGORIES.findIndex((cat) =>
      data.items.some((i) => cat.types.includes(i.type) && i.required && i.status !== "APPROVED")
    );
    if (firstPendingCategory !== -1) {
      setShowMissing(true);
      setActiveTab(firstPendingCategory);
      return;
    }
    if (token === "demo") {
      setStage("completed");
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

  const category = CATEGORIES[activeTab];
  const categoryItems = data.items.filter((i) => category.types.includes(i.type));
  const isLastTab = activeTab === CATEGORIES.length - 1;

  return (
    <Shell>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Progresso geral</span>
            <span>
              {activeTab + 1}/{CATEGORIES.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
              style={{ width: `${((activeTab + 1) / CATEGORIES.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat, idx) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                idx === activeTab
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">{category.title}</h1>
          <p className="text-sm text-slate-500">{category.description}</p>
        </div>

        <div className="space-y-3">
          {categoryItems.map((item, idx) => {
            const missing = showMissing && item.required && item.status !== "APPROVED";
            return item.multiple ? (
              <MultiItemCard key={item.id} token={token!} item={item} index={idx} onUploaded={handleUploaded} missing={missing} />
            ) : (
              <ItemCard key={item.id} token={token!} item={item} index={idx} onUploaded={handleUploaded} missing={missing} />
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

        {isLastTab ? (
          <Button size="lg" className="w-full" onClick={handleFinalize} disabled={finalizing}>
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Finalizar envio
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => setActiveTab((t) => t + 1)}>
            Continuar
          </Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
        <header className="mb-6 flex items-center justify-between">
          <Menu className="h-5 w-5 text-slate-400" />
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="MADM" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-semibold text-slate-700">MADM</span>
          </div>
          <HelpCircle className="h-5 w-5 text-slate-400" />
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-8 text-center text-xs text-slate-400">
          Conexão segura · Seus documentos são protegidos
        </footer>
      </div>
    </div>
  );
}
