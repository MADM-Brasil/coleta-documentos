import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Loader2, PhoneIncoming, PictureInPicture2, ShieldAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { videoApi, agentApi, realtimeUrl } from "../../lib/videoApi";
import { getAgentSession } from "../../lib/agentAuth";
import { useCallSession } from "./useCallSession";
import { ParticipantVideo } from "./components/ParticipantVideo";
import { VideoControls } from "./components/VideoControls";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { DocumentPanel } from "./components/DocumentPanel";
import { ShareLinkModal } from "../agent/ShareLinkModal";
import type { AgentCollection } from "./types";

interface AgentAttendanceProps {
  collectionId: string;
}

export function AgentAttendance({ collectionId }: AgentAttendanceProps) {
  const navigate = useNavigate();
  const session = useCallSession({ collectionId, role: "AGENT" });
  const [collection, setCollection] = useState<AgentCollection | null>(null);
  const [loadError, setLoadError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const loadCollection = useCallback(() => {
    videoApi
      .get<AgentCollection>(`/${collectionId}`)
      .then((res) => setCollection(res.data))
      .catch(() => setLoadError("Não foi possível carregar a documentação do cliente."));
  }, [collectionId]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  useEffect(() => {
    const socket: Socket = io(realtimeUrl, {
      path: "/realtime",
      query: { collectionId, agentSession: getAgentSession() ?? "" },
      transports: ["websocket", "polling"],
    });
    socket.on("document_uploaded", loadCollection);
    socket.on("document_approved", loadCollection);
    socket.on("document_rejected", loadCollection);
    return () => {
      socket.disconnect();
    };
  }, [collectionId, loadCollection]);

  async function handleApprove(itemId: string) {
    await videoApi.post(`/${collectionId}/items/${itemId}/approve`);
    loadCollection();
  }

  async function handleReject(itemId: string, reason: string) {
    await videoApi.post(`/${collectionId}/items/${itemId}/reject`, { reason });
    loadCollection();
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await videoApi.post(`/${collectionId}/complete`);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleShare() {
    const { data } = await agentApi.post(`/collections/${collectionId}/relink`);
    setShareLink(data.clientLink);
  }

  async function handlePictureInPicture() {
    try {
      const video = session.remoteVideoRef.current;
      if (!video) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* navegador pode bloquear PiP (sem interação do usuário, sem suporte etc.) — ignora silenciosamente */
    }
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white lg:flex-row">
      <div className="relative flex h-[38vh] max-h-[340px] shrink-0 flex-col overflow-hidden bg-slate-950 lg:h-screen lg:max-h-none lg:w-[56%]">
        <div className="relative min-h-0 flex-1">
          <ParticipantVideo
            ref={session.remoteVideoRef}
            label={session.clientName || "Cliente"}
            showPlaceholder={session.callState !== "active" || !session.remoteVideoActive}
          />
          <audio ref={session.remoteAudioRef} autoPlay />

          <div className="absolute left-4 top-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/painel")}
              aria-label="Voltar para o painel"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <ConnectionStatus
              label={
                session.callState === "active"
                  ? session.remoteScreenSharing
                    ? "Cliente compartilhando a tela"
                    : session.remoteVideoActive
                    ? "Chamada em andamento"
                    : "Aguardando vídeo do cliente..."
                  : session.peerConnected
                  ? "Cliente conectado"
                  : "Aguardando cliente..."
              }
              tone={session.callState === "active" ? "positive" : session.peerConnected ? "warning" : "neutral"}
            />
          </div>

          {session.callState === "active" && session.remoteVideoActive && (
            <button
              type="button"
              onClick={handlePictureInPicture}
              aria-label="Abrir vídeo em janela flutuante"
              title="Abrir vídeo em janela flutuante"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          )}

          <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 shadow-lg sm:h-40 sm:w-32">
            <ParticipantVideo ref={session.localVideoRef} label="Você" muted showPlaceholder={session.callState !== "active"} />
          </div>

          {session.callState === "incoming" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-card animate-fade-in">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="absolute inset-0 animate-pulse-dot rounded-full bg-brand-100" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <PhoneIncoming className="h-7 w-7" />
                  </div>
                </div>
                <p className="font-semibold text-slate-900">Chamada do cliente</p>
                <div className="flex gap-2">
                  <Button variant="danger" size="lg" onClick={session.declineCall}>
                    Recusar
                  </Button>
                  <Button size="lg" onClick={session.acceptCall}>
                    Aceitar chamada
                  </Button>
                </div>
              </div>
            </div>
          )}

          {session.callState === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {session.mediaError && (
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-2 text-sm text-white">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {session.mediaError}
            </div>
          )}
        </div>

        {session.callState === "active" && (
          <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3">
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
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:w-[44%]">
        {loadError && <div className="p-4 text-sm text-red-600">{loadError}</div>}
        {collection && (
          <DocumentPanel
            collection={collection}
            onApprove={handleApprove}
            onReject={handleReject}
            onFinalize={handleFinalize}
            finalizing={finalizing}
            onShare={handleShare}
          />
        )}
      </div>

      {shareLink && collection && (
        <ShareLinkModal clientName={collection.client.name} link={shareLink} onClose={() => setShareLink(null)} />
      )}
    </div>
  );
}
