import Link from 'next/link';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/expenses', label: 'Expenses' },
  { href: '/expenses/monthly', label: 'Month' },
  { href: '/expenses/categories', label: 'Categories' },
];

export function ExpenseTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Expense views" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? 'page' : undefined}
          className={cn('inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold', active === t.href ? 'bg-ink text-white' : 'border border-border bg-surface text-ink-muted hover:bg-canvas')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
