'use client';

import Link from 'next/link';
import { ChevronRight, MessageSquareWarning, Plus } from 'lucide-react';
import { COMPLAINT_CATEGORY_LABELS, type ComplaintSummaryItem } from '@mess/shared';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { LinkedOnly } from '@/components/student/linked-only';
import { useLoadMore } from '@/components/student/paged';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';

const newLink = 'inline-flex min-h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-500';

function Complaints() {
  const { items, meta, error, loading, load, hasMore } = useLoadMore<ComplaintSummaryItem>('/students/me/complaints');
  if (!meta && error) return <ErrorState title="Couldn't load complaints" description={error} onRetry={() => load(1)} />;
  if (!meta) return <Skeleton className="h-40" />;
  if (!items.length) return <EmptyState icon={MessageSquareWarning} title="You haven't raised any complaints." action={<Link href="/student/complaints/new" className={newLink}>Raise a complaint</Link>} />;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/student/complaints/${c.id}`} className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 hover:border-brand-300">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{COMPLAINT_CATEGORY_LABELS[c.category]}</span><ComplaintStatusBadge status={c.status} /></span>
              <span className="mt-1 line-clamp-2 block">{c.description}</span>
              <span className="block text-xs text-ink-muted">{formatDateTime(c.createdAt)}{c.responseCount ? ` · ${c.responseCount} ${c.responseCount === 1 ? 'reply' : 'replies'}` : ''}</span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </li>
      ))}
      {hasMore && <Button variant="secondary" loading={loading} onClick={() => load(meta.page + 1)}>Load more</Button>}
    </ul>
  );
}

export default function StudentComplaintsPage() {
  return (
    <>
      <PageHeader title="My complaints" actions={<Link href="/student/complaints/new" className={newLink}><Plus className="size-4" aria-hidden /> Raise a complaint</Link>} />
      <LinkedOnly><Complaints /></LinkedOnly>
    </>
  );
}
