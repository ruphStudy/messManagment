import { MEAL_LABELS, PauseStatus, type PauseRecord } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/format';
import { shortDate } from '@/lib/menu';

/** One pause line, used on the Meal Pause page and on student detail. */
export function PauseRow({ pause, showStudent = true, onCancel }: { pause: PauseRecord; showStudent?: boolean; onCancel?: (p: PauseRecord) => void }) {
  const cancelled = pause.status === PauseStatus.CANCELLED;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5', cancelled && 'opacity-60')}>
      <span className="w-28 shrink-0 text-sm font-medium">{shortDate(pause.date)}</span>
      <Badge tone="brand">{MEAL_LABELS[pause.mealType]}</Badge>
      {showStudent && <span className="font-semibold">{fullName(pause.student)}</span>}
      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
        {pause.reason ?? '—'} · by {pause.source === 'STUDENT' ? 'student' : (pause.createdBy ?? 'mess')}
        {cancelled && ` · cancelled${pause.cancelledBy ? ` by ${pause.cancelledBy}` : ''}`}
      </span>
      {cancelled ? <Badge>Cancelled</Badge> : onCancel && pause.canCancel && (
        <Button size="sm" variant="ghost" onClick={() => onCancel(pause)}>Cancel pause</Button>
      )}
    </div>
  );
}
