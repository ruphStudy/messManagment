import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface StatItem {
  label: string;
  value: ReactNode;
  note?: string;
  href?: string;
  tone?: 'danger';
}

/** Compact number tiles; tiles with `href` link to the filtered list. */
export function StatGrid({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {items.map((s) => {
        const body = (
          <>
            <dt className="text-sm text-ink-muted">{s.label}</dt>
            <dd className={cn('text-2xl font-bold', s.tone === 'danger' && 'text-danger')}>{s.value}</dd>
            {s.note && <dd className="text-xs text-ink-muted">{s.note}</dd>}
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="rounded-card border border-border bg-surface p-4 hover:border-brand-300">{body}</Link>
        ) : (
          <div key={s.label} className="rounded-card border border-border bg-surface p-4">{body}</div>
        );
      })}
    </dl>
  );
}
