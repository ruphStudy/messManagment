import { RATING_DIMENSIONS, RATING_LABELS, type RatingSummary } from '@mess/shared';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const tone = (v: number | null) => (v === null ? 'text-ink-muted' : v >= 4 ? 'text-success' : v >= 3 ? 'text-warning' : 'text-danger');

/** Five average cards plus counts. Averages exclude meals later reversed. */
export function RatingSummaryCards({ summary }: { summary: RatingSummary | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {RATING_DIMENSIONS.map((d) => {
        const v = summary?.averages[d] ?? null;
        return (
          <Card key={d} className="p-4 sm:p-4">
            <p className="text-sm text-ink-muted">{RATING_LABELS[d]}</p>
            <p className={cn('text-2xl font-bold', tone(v))}>{summary ? (v === null ? '—' : `${v.toFixed(1)}★`) : '–'}</p>
          </Card>
        );
      })}
      <Card className="p-4 sm:p-4">
        <p className="text-sm text-ink-muted">Ratings</p>
        <p className="text-2xl font-bold">{summary ? summary.mealCount : '–'}</p>
        <p className="text-xs text-ink-muted">{summary ? `+ ${summary.generalCount} general` : ' '}</p>
      </Card>
    </div>
  );
}
