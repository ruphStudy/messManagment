import { formatPaise, type ExpenseSummary } from '@mess/shared';

/** Simple bar list — no chart library. */
export function CategoryBreakdown({ summary, limit }: { summary: ExpenseSummary; limit?: number }) {
  const rows = limit ? summary.categories.slice(0, limit) : summary.categories;
  const max = rows[0]?.totalPaise ?? 0;
  if (!rows.length) return <p className="text-sm text-ink-muted">No expenses.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((c) => (
        <li key={c.categoryId}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="font-medium">{c.name} <span className="font-normal text-ink-muted">· {c.count}</span></span>
            <span className="font-semibold">{formatPaise(c.totalPaise)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${max ? Math.max(2, (c.totalPaise / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
