import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { publicApi, extractErrorMessage } from "../../lib/api";
import { realtimeUrl } from "../../lib/videoApi";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { ItemCard } from "../client/ItemCard";
import { MultiItemCard } from "../client/MultiItemCard";
import type { ClientCollection as ClientCollectionData, ClientMedia } from "../client/types";
import { useCallSession } from "./useCallSession";
import { ParticipantVideo } from "./components/ParticipantVideo";
import { VideoControls } from "./components/VideoControls";
import { ConnectionStatus } from "./components/ConnectionStatus";

interface ClientAttendanceProps {
  collectionId: string;
  token: string;
}

type Stage = "loading" | "error" | "checklist" | "completed";

export function ClientAttendance({ collectionId, token }: ClientAttendanceProps) {
  const session = useCallSession({ collectionId, token, role: "CLIENT" });
  const [stage, setStage] = useState<Stage>("loading");
  const [data, setData] = useState<ClientCollectionData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // Clicar em qualquer um dos dois vídeos troca qual fica grande.
  const [swapped, setSwapped] = useState(false);
  // Item (áudio ou vídeo) que o consultor está gravando agora — mostra um status "em
  // andamento" no lugar dos controles normais de gravação do cliente.
  const [activeCaptureItemId, setActiveCaptureItemId] = useState<string | null>(null);
  // Contagem regressiva (3,2,1) exibida por cima do vídeo da chamada, não no card do
  // item — é lá que o cliente está olhando quando o consultor pede pra se posicionar.
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);

  useEffect(() => {
    publicApi
      .get<ClientCollectionData>(`/${token}`)
      .then((res) => {
        setData(res.data);
        setStage(res.data.status === "COMPLETED" ? "completed" : "checklist");
      })
      .catch((err) => {
        setErrorMessage(extractErrorMessage(err, "Não foi possível abrir sua coleta."));
        setStage("error");
      });
  }, [token]);

  // Escuta aprovação/reenvio em tempo real — sem isso, o cliente só via a atualização
  // depois de atualizar a página (o que também derrubava a chamada de vídeo).
  useEffect(() => {
    const socket = io(realtimeUrl, {
      path: "/realtime",
      query: { collectionId, token },
      transports: ["websocket", "polling"],
    });

    socket.on("document_approved", ({ itemId }: { itemId: string }) => {
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, status: "APPROVED" } : i)) }
          : prev
      );
    });

    socket.on("document_rejected", ({ itemId, reason }: { itemId: string; reason: string }) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId ? { ...i, status: "REJECTED", rejectionReason: reason } : i
              ),
            }
          : prev
      );
    });

    socket.on("media_capture_start", ({ itemId }: { itemId: string }) => setActiveCaptureItemId(itemId));
    socket.on("media_capture_cancel", ({ itemId }: { itemId: string }) =>
      setActiveCaptureItemId((current) => (current === itemId ? null : current))
    );

    // O consultor pode enviar o áudio direto (gravado a partir da própria chamada) —
    // atualiza o item pro cliente ver "Em análise" sem precisar recarregar a página.
    socket.on("document_uploaded", ({ itemId }: { itemId: string }) => {
      setActiveCaptureItemId((current) => (current === itemId ? null : current));
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, status: "UPLOADED" } : i)) }
          : prev
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [collectionId, token]);

  // Contagem local (aproximada — o consultor faz a mesma do lado dele antes da
  // gravação de verdade começar) exibida por cima do vídeo da chamada.
  useEffect(() => {
    if (!activeCaptureItemId) {
      setCaptureCountdown(null);
      return;
    }
    let secondsLeft = 3;
    setCaptureCountdown(secondsLeft);
    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setCaptureCountdown(null);
      } else {
        setCaptureCountdown(secondsLeft);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCaptureItemId]);

  function handleUploaded(itemId: string, collectionStatus: string, media?: ClientMedia) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId
                ? { ...i, status: "UPLOADED", rejectionReason: null, media: media ? [...i.media, media] : i.media }
                : i
            ),
          }
        : prev
    );
    if (collectionStatus === "COMPLETED") setStage("completed");
  }

  async function handleFinalize() {
    if (!data) return;
    const pending = data.items.some((i) => i.required && i.status !== "UPLOADED" && i.status !== "APPROVED");
    if (pending) {
      setShowMissing(true);
      return;
    }
    setFinalizing(true);
    setErrorMessage("");
    try {
      const { data: resp } = await publicApi.post(`/${token}/finish`);
      if (resp.collectionStatus === "COMPLETED") setStage("completed");
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, "Não conseguimos finalizar seu envio. Tente novamente."));
    } finally {
      setFinalizing(false);
    }
  }

  const videoStatusLabel =
    session.callState === "active"
      ? session.remoteScreenSharing
        ? "Consultor compartilhando a tela"
        : "Em chamada"
      : session.callState === "incoming" || session.callState === "connecting"
      ? "Conectando..."
      : session.peerConnected
      ? "Consultor disponível"
      : "Aguardando consultor...";

  const videoArea = (
    <div className="relative h-full w-full bg-slate-900">
      <button
        type="button"
        onClick={() => setSwapped((v) => !v)}
        aria-label="Trocar vídeo principal"
        className={
          swapped
            ? "absolute bottom-3 right-3 z-10 h-20 w-16 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg sm:h-28 sm:w-20"
            : "absolute inset-0"
        }
      >
        <ParticipantVideo
          ref={session.remoteVideoRef}
          label="Consultor"
          showPlaceholder={session.callState !== "active" || !session.remoteVideoActive}
          micMuted={session.remoteMicMuted}
        />
      </button>
      <audio ref={session.remoteAudioRef} autoPlay />

      <div className="absolute left-3 top-3">
        <ConnectionStatus
          label={videoStatusLabel}
          tone={session.callState === "active" ? "positive" : session.peerConnected ? "warning" : "neutral"}
        />
      </div>

      <button
        type="button"
        onClick={() => setSwapped((v) => !v)}
        aria-label="Trocar vídeo principal"
        className={
          swapped
            ? "absolute inset-0"
            : "absolute bottom-3 right-3 z-10 h-20 w-16 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg sm:h-28 sm:w-20"
        }
      >
        <ParticipantVideo
          ref={session.localVideoRef}
          label="Você"
          muted
          showPlaceholder={session.callState !== "active"}
          micMuted={!session.micEnabled}
        />
      </button>

      {session.callState === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {session.mediaError && (
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-lg bg-red-600/90 px-2 py-1.5 text-xs text-white">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {session.mediaError}
        </div>
      )}

      {session.callState === "ended" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900 text-center">
          <p className="text-sm font-medium text-white">Chamada encerrada</p>
          <p className="max-w-[220px] text-xs text-slate-400">
            Você pode continuar enviando seus documentos normalmente.
          </p>
        </div>
      )}

      {captureCountdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 backdrop-blur-sm">
          <span className="text-5xl font-bold text-white">{captureCountdown}</span>
          <p className="text-sm font-medium text-white">Prepare-se, a gravação já vai começar...</p>
        </div>
      )}
    </div>
  );

  const videoControlsBar = session.callState === "active" && (
    <div className="shrink-0 border-t border-white/10 bg-slate-950 px-3 py-2.5">
      <VideoControls
        micEnabled={session.micEnabled}
        camEnabled={session.camEnabled}
        screenShareEnabled={session.screenShareEnabled}
        onToggleMic={session.toggleMic}
        onToggleCam={session.toggleCam}
        onToggleScreenShare={session.toggleScreenShare}
        onEndCall={session.endCall}
      />
    </div>
  );

  if (stage === "loading") {
    return (
      <FullScreen>
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 p-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </FullScreen>
    );
  }

  if (stage === "error") {
    return (
      <FullScreen>
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center p-5">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <ShieldCheck className="h-10 w-10 text-red-400" />
            <p className="font-semibold text-red-700">Não conseguimos abrir seu atendimento</p>
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        </div>
      </FullScreen>
    );
  }

  if (!data) return null;

  const done = data.items.filter((i) => i.status === "UPLOADED" || i.status === "APPROVED").length;
  const total = data.items.length;

  return (
    <div className="flex h-screen w-full flex-col bg-white lg:flex-row">
      <div className="flex shrink-0 flex-col lg:h-screen lg:w-[38%]">
        <div className="h-56 min-h-0 shrink-0 overflow-hidden lg:h-auto lg:flex-1">{videoArea}</div>
        {videoControlsBar}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-5 py-6">
          {stage === "completed" ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center animate-fade-in">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Tudo certo, {data.client.name.split(" ")[0]}!</h1>
              <p className="max-w-xs text-sm text-slate-500">
                Recebemos todos os seus documentos. Nossa equipe já vai dar continuidade ao seu atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="text-xl font-bold text-slate-900">Documentação</h1>
                <p className="text-sm text-slate-500">
                  Envie cada item abaixo enquanto conversa com o consultor. Você pode continuar mesmo sem a
                  chamada estar conectada.
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
                  const missing = showMissing && item.required && item.status !== "UPLOADED" && item.status !== "APPROVED";
                  return (
                    <div key={item.id}>
                      {item.type === "CTPS" && (
                        <p className="mb-3 mt-2 text-sm font-bold text-slate-900">Documentos do GOV</p>
                      )}
                      {item.multiple ? (
                        <MultiItemCard token={token} item={item} index={idx} onUploaded={handleUploaded} missing={missing} />
                      ) : (
                        <ItemCard
                          token={token}
                          item={item}
                          index={idx}
                          onUploaded={handleUploaded}
                          missing={missing}
                          captureActive={activeCaptureItemId === item.id}
                          captureCountdown={activeCaptureItemId === item.id ? captureCountdown : null}
                          getSelfStream={() => session.localVideoRef.current?.srcObject as MediaStream | null}
                        />
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
          )}
        </div>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen w-full flex-col bg-white">{children}</div>;
}
