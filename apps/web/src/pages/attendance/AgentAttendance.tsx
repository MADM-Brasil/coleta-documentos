import { useCallback, useEffect, useRef, useState } from "react";
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
  const [pipError, setPipError] = useState<string | null>(null);
  // Clicar em qualquer um dos dois vídeos troca qual fica grande — não desconecta
  // nem reanexa nada, só troca o tamanho/posição via CSS.
  const [swapped, setSwapped] = useState(false);
  function setMediaErrorLocal(msg: string) {
    setPipError(msg);
  }
  // PiP nativo do navegador só mostra UM <video> — pra caber cliente + consultor na
  // janela flutuante, compõe os dois num canvas (desenhado a cada frame) e usa esse
  // canvas como fonte de um <video> escondido, que é esse que vai pro PiP de verdade.
  const pipCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const pipRafRef = useRef<number | null>(null);

  // Gravação do áudio/vídeo do cliente (itens tipo AUDIO ou VIDEO), feita a partir dos
  // próprios tracks já recebidos na chamada — o cliente não precisa gravar nada no
  // celular (e não perde a câmera da chamada abrindo o app de câmera do sistema).
  const [recordingItemId, setRecordingItemId] = useState<string | null>(null);
  // Contagem regressiva de 3s antes da gravação de fato começar — dá tempo do cliente
  // se posicionar. null = não está em contagem (já gravando ou parado).
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomSocketRef = useRef<Socket | null>(null);

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
    roomSocketRef.current = socket;
    socket.on("document_uploaded", loadCollection);
    socket.on("document_approved", loadCollection);
    socket.on("document_rejected", loadCollection);
    return () => {
      socket.disconnect();
      roomSocketRef.current = null;
    };
  }, [collectionId, loadCollection]);

  function startCapture(itemId: string, kind: "AUDIO" | "VIDEO") {
    const stream =
      kind === "VIDEO" ? session.getRemoteCameraStream() : (session.remoteAudioRef.current?.srcObject as MediaStream | null);
    if (!stream) {
      setPipError(
        kind === "VIDEO"
          ? "O vídeo do cliente ainda não está disponível — confirme que a câmera dele está ligada."
          : "O áudio do cliente ainda não está disponível — confirme que a chamada está ativa."
      );
      return;
    }
    setRecordingItemId(itemId);
    roomSocketRef.current?.emit("media_capture_start", { itemId });

    // 3, 2, 1... só depois disso o MediaRecorder realmente começa — dá tempo do
    // cliente se posicionar pro movimento pedido.
    let secondsLeft = 3;
    setCaptureCountdown(secondsLeft);
    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCaptureCountdown(null);

        const recorder = new MediaRecorder(stream);
        mediaChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) mediaChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } else {
        setCaptureCountdown(secondsLeft);
      }
    }, 1000);
  }

  function cancelCapture(itemId: string) {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
    setCaptureCountdown(null);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    setRecordingItemId(null);
    roomSocketRef.current?.emit("media_capture_cancel", { itemId });
  }

  function stopAndUploadCapture(itemId: string, kind: "AUDIO" | "VIDEO") {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      try {
        const ext = kind === "VIDEO" ? "webm" : "webm";
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || `${kind === "VIDEO" ? "video" : "audio"}/webm` });
        const formData = new FormData();
        formData.append(
          "file",
          new File([blob], `${kind === "VIDEO" ? "video" : "audio"}-${Date.now()}.${ext}`, { type: blob.type })
        );
        await videoApi.post(`/${collectionId}/items/${itemId}/agent-upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        loadCollection();
      } catch {
        setPipError("Não foi possível enviar a gravação. Tente novamente.");
      } finally {
        mediaRecorderRef.current = null;
        setRecordingItemId(null);
        roomSocketRef.current?.emit("media_capture_cancel", { itemId });
      }
    };
    recorder.stop();
  }

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

  function stopPipCompositing() {
    if (pipRafRef.current) cancelAnimationFrame(pipRafRef.current);
    pipRafRef.current = null;
  }

  async function handlePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (!document.pictureInPictureEnabled) {
        setMediaErrorLocal("Esse navegador não suporta janela flutuante (Picture-in-Picture).");
        return;
      }
      const canvas = pipCanvasRef.current;
      const pipVideo = pipVideoRef.current;
      const remote = session.remoteVideoRef.current;
      const local = session.localVideoRef.current;
      if (!canvas || !pipVideo || !remote) return;

      // Vertical (celular do cliente é a fonte principal, quase sempre em pé).
      canvas.width = 540;
      canvas.height = 960;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Desenha "cobrindo" o quadro (igual object-fit: cover) — mantém a proporção
      // real da câmera em vez de esticar/distorcer o vídeo pra caber no canvas.
      function drawCover(video: HTMLVideoElement, x: number, y: number, w: number, h: number) {
        if (!ctx || !video.videoWidth || !video.videoHeight) return;
        const srcRatio = video.videoWidth / video.videoHeight;
        const dstRatio = w / h;
        let sx = 0,
          sy = 0,
          sw = video.videoWidth,
          sh = video.videoHeight;
        if (srcRatio > dstRatio) {
          sw = video.videoHeight * dstRatio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / dstRatio;
          sy = (video.videoHeight - sh) / 2;
        }
        ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
      }

      function draw() {
        if (!ctx || !canvas) return;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (remote && remote.readyState >= 2) drawCover(remote, 0, 0, canvas.width, canvas.height);
        if (local && local.readyState >= 2) {
          const pipW = canvas.width * 0.32;
          const pipH = pipW * (local.videoHeight / local.videoWidth || 0.75);
          const x = canvas.width - pipW - 16;
          const y = canvas.height - pipH - 16;
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 3;
          drawCover(local, x, y, pipW, pipH);
          ctx.strokeRect(x, y, pipW, pipH);
          ctx.restore();
        }
        pipRafRef.current = requestAnimationFrame(draw);
      }

      // Desenha um frame antes de capturar o stream, pra garantir que o vídeo já
      // nasce com conteúdo real (não em branco) e o navegador aceite o PiP de cara.
      draw();

      if (!pipVideo.srcObject) {
        pipVideo.srcObject = canvas.captureStream(25);
      }
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
      pipVideo.addEventListener("leavepictureinpicture", stopPipCompositing, { once: true });
    } catch (err) {
      console.error("PiP falhou:", err);
      setMediaErrorLocal(
        err instanceof Error ? `Não foi possível abrir a janela flutuante: ${err.message}` : "Não foi possível abrir a janela flutuante."
      );
    }
  }

  useEffect(() => stopPipCompositing, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white lg:flex-row">
      <div className="relative flex h-[38vh] max-h-[340px] shrink-0 flex-col overflow-hidden bg-slate-950 lg:h-screen lg:max-h-none lg:w-[56%]">
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            onClick={() => setSwapped((v) => !v)}
            aria-label="Trocar vídeo principal"
            className={
              swapped
                ? "absolute bottom-4 right-4 z-10 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 shadow-lg sm:h-40 sm:w-32"
                : "absolute inset-0"
            }
          >
            <ParticipantVideo
              ref={session.remoteVideoRef}
              label={session.clientName || "Cliente"}
              showPlaceholder={session.callState !== "active" || !session.remoteVideoActive}
              micMuted={session.remoteMicMuted}
            />
          </button>
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

          <button
            type="button"
            onClick={() => setSwapped((v) => !v)}
            aria-label="Trocar vídeo principal"
            className={
              swapped
                ? "absolute inset-0"
                : "absolute bottom-4 right-4 z-10 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 shadow-lg sm:h-40 sm:w-32"
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

          {(session.mediaError || pipError) && (
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-2 text-sm text-white">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {session.mediaError || pipError}
            </div>
          )}

          {session.callState === "ended" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900 text-center">
              <p className="text-sm font-medium text-white">Chamada encerrada</p>
              <p className="max-w-[240px] text-xs text-slate-400">
                A conexão de vídeo foi encerrada — o cliente continua com a documentação aberta.
              </p>
            </div>
          )}

          {captureCountdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
              <span className="text-6xl font-bold text-white">{captureCountdown}</span>
              <p className="text-sm font-medium text-white">Prepare o cliente para o movimento...</p>
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
            recordingItemId={recordingItemId}
            captureCountdown={captureCountdown}
            onStartCapture={startCapture}
            onCancelCapture={cancelCapture}
            onStopCapture={stopAndUploadCapture}
          />
        )}
      </div>

      {shareLink && collection && (
        <ShareLinkModal clientName={collection.client.name} link={shareLink} onClose={() => setShareLink(null)} />
      )}

      <canvas ref={pipCanvasRef} className="hidden" />
      <video ref={pipVideoRef} muted playsInline className="absolute h-px w-px opacity-0" />
    </div>
  );
}
