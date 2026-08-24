import { forwardRef } from "react";
import { UserRound } from "lucide-react";

interface ParticipantVideoProps {
  label: string;
  muted?: boolean;
  showPlaceholder?: boolean;
  compact?: boolean;
}

export const ParticipantVideo = forwardRef<HTMLVideoElement, ParticipantVideoProps>(
  ({ label, muted, showPlaceholder, compact }, ref) => (
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
      <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  )
);
ParticipantVideo.displayName = "ParticipantVideo";
