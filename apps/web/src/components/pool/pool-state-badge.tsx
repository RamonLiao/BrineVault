import { Badge } from '@/components/ui/badge';
import { POOL_STATE_LABELS, type PoolState } from '@/types';

const STATE_COLOURS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  dd_in_progress: 'bg-blue-100 text-blue-600 border-blue-200',
  ic_review: 'bg-amber-100 text-amber-600 border-amber-200',
  approved_internal: 'bg-green-100 text-green-600 border-green-200',
  ready_to_issue: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  issued: 'bg-indigo-100 text-indigo-600 border-indigo-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface PoolStateBadgeProps {
  state: PoolState | string;
  className?: string;
}

export function PoolStateBadge({ state, className }: PoolStateBadgeProps) {
  const label = POOL_STATE_LABELS[state as PoolState] ?? 'Unknown';
  const colours = STATE_COLOURS[state] ?? 'bg-gray-100 text-gray-500 border-gray-200';

  return (
    <Badge variant="outline" className={`${colours} ${className ?? ''}`}>
      {label}
    </Badge>
  );
}
