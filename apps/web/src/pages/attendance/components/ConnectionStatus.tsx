interface ConnectionStatusProps {
  label: string;
  tone?: "neutral" | "positive" | "warning";
}

export function ConnectionStatus({ label, tone = "neutral" }: ConnectionStatusProps) {
  const dot =
    tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${tone === "positive" ? "animate-pulse-dot" : ""}`} />
      {label}
    </div>
  );
}
