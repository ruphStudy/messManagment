'use client';

import { ChevronRight } from 'lucide-react';
import { STUDENT_STATUS_LABELS, type StudentMessMembership } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';

/** Pick which mess to use. Inactive memberships and suspended messes stay visible but can't be chosen. */
export function MessChooser({ memberships, current, onSelect }: { memberships: StudentMessMembership[]; current: StudentMessMembership | null; onSelect: (messId: string) => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Choose your mess" description="You're a student in more than one mess. Pick the one you want to use now — you can switch any time." />
      <ul className="flex flex-col gap-2">
        {memberships.map((m) => {
          const why = m.messStatus !== 'ACTIVE' ? 'Temporarily unavailable' : m.status !== 'ACTIVE' ? `Membership ${STUDENT_STATUS_LABELS[m.status].toLowerCase()}` : null;
          return (
            <li key={m.messId}>
              <button
                type="button"
                disabled={!m.usable}
                onClick={() => onSelect(m.messId)}
                className={cn('flex w-full items-center gap-3 rounded-card border bg-surface p-4 text-left', m.usable ? 'border-border hover:border-brand-300' : 'cursor-not-allowed border-border opacity-60', current?.messId === m.messId && 'ring-2 ring-brand-500')}
              >
                <span className="flex-1">
                  <span className="block font-semibold">{m.messName}{current?.messId === m.messId && ' (current)'}</span>
                  {why && <Badge tone="neutral">{why}</Badge>}
                </span>
                {m.usable && <ChevronRight className="size-5 text-ink-muted" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
