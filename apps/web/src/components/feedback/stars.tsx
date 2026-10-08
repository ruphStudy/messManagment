import { Star } from 'lucide-react';
import { RATING_MAX } from '@mess/shared';
import { cn } from '@/lib/cn';

/** Read-only 1–5 stars with the number for screen readers. */
export function Stars({ value, size = 'sm' }: { value: number | null; size?: 'sm' | 'md' }) {
  if (value === null) return <span className="text-sm text-ink-muted">—</span>;
  const cls = size === 'md' ? 'size-5' : 'size-4';
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of ${RATING_MAX}`}>
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <Star key={i} className={cn(cls, i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} aria-hidden />
      ))}
    </span>
  );
}
