interface ProgressBarProps {
  value: number;
  total: number;
  className?: string;
}

export function ProgressBar({ value, total, className = "" }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={className}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-surface-hover">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
