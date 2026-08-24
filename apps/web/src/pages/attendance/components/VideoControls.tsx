import { Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare, ScreenShareOff } from "lucide-react";

interface VideoControlsProps {
  micEnabled: boolean;
  camEnabled: boolean;
  screenShareEnabled?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare?: () => void;
  onEndCall: () => void;
}

export function VideoControls({
  micEnabled,
  camEnabled,
  screenShareEnabled,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onEndCall,
}: VideoControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <ControlButton active={micEnabled} onClick={onToggleMic} label={micEnabled ? "Silenciar" : "Ativar microfone"}>
        {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </ControlButton>
      <ControlButton active={camEnabled} onClick={onToggleCam} label={camEnabled ? "Desligar câmera" : "Ligar câmera"}>
        {camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </ControlButton>
      {onToggleScreenShare && (
        <ControlButton
          active={!screenShareEnabled}
          onClick={onToggleScreenShare}
          label={screenShareEnabled ? "Parar compartilhamento de tela" : "Compartilhar tela"}
        >
          {screenShareEnabled ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
        </ControlButton>
      )}
      <button
        type="button"
        onClick={onEndCall}
        aria-label="Encerrar chamada"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700"
      >
        <PhoneOff className="h-5 w-5" />
      </button>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          : "border-transparent bg-slate-800 text-white hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
