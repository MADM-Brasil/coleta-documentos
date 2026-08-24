import { ProgressBar } from "../../../components/ui/ProgressBar";

interface CollectionProgressProps {
  approved: number;
  total: number;
}

export function CollectionProgress({ approved, total }: CollectionProgressProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Documentação</span>
        <span className="font-semibold text-slate-900">
          {approved}/{total}
        </span>
      </div>
      <ProgressBar value={approved} total={total} />
    </div>
  );
}
