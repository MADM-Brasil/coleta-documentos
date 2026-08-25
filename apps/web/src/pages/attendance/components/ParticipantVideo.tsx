import { forwardRef } from "react";
import { MicOff, UserRound } from "lucide-react";

interface ParticipantVideoProps {
  label: string;
  muted?: boolean;
  showPlaceholder?: boolean;
  compact?: boolean;
  // Mostra um selo indicando que o microfone dessa pessoa está desligado —
  // independente do atributo "muted" acima (que controla o áudio do <video>).
  micMuted?: boolean;
}

export const ParticipantVideo = forwardRef<HTMLVideoElement, ParticipantVideoProps>(
  ({ label, muted, showPlaceholder, compact, micMuted }, ref) => (
    <div className={`relative h-full w-full overflow-hidden bg-slate-900 ${compact ? "rounded-xl" : ""}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="h-full w-full object-contain"
      />
      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 text-slate-400">
          <UserRound className="h-8 w-8" />
        </div>
      )}
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
        {micMuted && <MicOff className="h-3 w-3 text-red-400" />}
        {label}
      </span>
    </div>
  )
);
ParticipantVideo.displayName = "ParticipantVideo";
