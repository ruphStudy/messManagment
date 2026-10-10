import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Day editor ↔ week overview switch. */
export function MenuTabs({ active, date }: { active: 'day' | 'week'; date: string }) {
  const tab = (key: 'day' | 'week', href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold',
        active === key ? 'bg-ink text-white dark:text-canvas' : 'text-ink-muted hover:bg-slate-100',
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Menu views" className="flex gap-1 rounded-full border border-border bg-surface p-1">
      {tab('day', `/menu?date=${date}`, 'Day')}
      {tab('week', `/menu/week?week=${date}`, 'Week')}
    </nav>
  );
}
