import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface CameraCaptureModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  onFallbackToSystemCamera: () => void;
}

// Câmera dentro da própria página (getUserMedia + canvas), em vez do
// <input capture> que abre o app de câmera do sistema — abrir um app nativo tira o
// navegador de primeiro plano e pode derrubar a chamada de vídeo em curso (o
// navegador/SO mata a aba em segundo plano em aparelhos com pouca memória).
export function CameraCaptureModal({ onCapture, onClose, onFallbackToSystemCamera }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Não conseguimos acessar sua câmera. Verifique as permissões do navegador.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-white">Tirar foto</span>
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-white">{error}</p>
            <Button size="md" onClick={onFallbackToSystemCamera}>
              Usar câmera do sistema
            </Button>
          </div>
        )}
      </div>

      {ready && (
        <div className="flex items-center justify-center p-6">
          <button
            type="button"
            onClick={handleCapture}
            aria-label="Capturar foto"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 active:scale-95"
          >
            <Camera className="h-7 w-7 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
