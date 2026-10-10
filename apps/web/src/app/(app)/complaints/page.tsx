'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Image as ImageIcon, MessageSquareWarning, SearchX, X } from 'lucide-react';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  ComplaintCategory,
  ComplaintStatus,
  isValidDateString,
  Permission,
  type ComplaintCounts,
  type ComplaintListItem,
} from '@mess/shared';
import { PersonName } from '@/components/ui/avatar';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDateTime, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function ComplaintsScreen() {
  const router = useRouter();
  const list = useListParams();
  const status = list.get('status');
  const category = list.get('category');
  const from = isValidDateString(list.get('from')) ? list.get('from') : '';
  const to = isValidDateString(list.get('to')) ? list.get('to') : '';
  const { page, search } = list;
  const [counts, setCounts] = useState<ComplaintCounts | null>(null);

  useEffect(() => {
    api<ComplaintCounts>('/complaints/counts').then(setCounts).catch(() => setCounts(null));
  }, []);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (status) q.set('status', status);
    if (category) q.set('category', category);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (search) q.set('search', search);
    return q.toString();
  }, [page, status, category, from, to, search]);
  const { result, error, retry } = usePagedList<ComplaintListItem>(`/complaints?${apiQuery}`);
  const hasFilters = !!(status || category || from || to || search);

  return (
    <>
      <PageHeader title="Complaints" description="Open complaints are shown first." />
      <div role="tablist" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[{ value: '', label: 'All' }, ...Object.values(ComplaintStatus).map((s) => ({ value: s, label: COMPLAINT_STATUS_LABELS[s] }))].map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => list.setParams({ status: t.value, page: 1 })}
            className={cn('min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium', status === t.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas')}
          >
            {t.label}{t.value && counts ? ` (${counts[t.value as ComplaintStatus]})` : ''}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        <Select id="category" label="Category" options={[{ value: '', label: 'All categories' }, ...Object.values(ComplaintCategory).map((c) => ({ value: c, label: COMPLAINT_CATEGORY_LABELS[c] }))]} value={category} onChange={(e) => list.setParams({ category: e.target.value, page: 1 })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-sm font-medium">From</label>
          <input id="from" type="date" value={from} onChange={(e) => list.setParams({ from: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-sm font-medium">To</label>
          <input id="to" type="date" value={to} onChange={(e) => list.setParams({ to: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
      </div>
      {hasFilters && (
        <button onClick={() => list.clear(['status', 'category', 'from', 'to'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? <ErrorState title="Couldn't load complaints" description={error} onRetry={retry} /> : !result ? <Skeleton className="h-48" /> : result.data.length === 0 ? (
        hasFilters ? <EmptyState icon={SearchX} title="No complaints match your filters." /> : <EmptyState icon={MessageSquareWarning} title="No complaints yet." />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {result.data.map((c) => (
              <li key={c.id}>
                <Card className="flex cursor-pointer items-center gap-3 p-4 hover:bg-canvas sm:p-4" onClick={() => router.push(`/complaints/${c.id}`)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ComplaintStatusBadge status={c.status} />
                      <span className="font-semibold">{COMPLAINT_CATEGORY_LABELS[c.category]}</span>
                      <PersonName name={fullName(c.student)} className="text-sm text-ink-muted">{fullName(c.student)} · {formatDateTime(c.createdAt)}</PersonName>
                      {c.hasAttachment && <ImageIcon className="size-4 text-ink-muted" aria-label="Has photo" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{c.description}</p>
                    {c.responseCount > 0 && <p className="text-xs text-ink-muted">{c.responseCount} {c.responseCount === 1 ? 'reply' : 'replies'}</p>}
                  </div>
                  <Link href={`/complaints/${c.id}`} onClick={(e) => e.stopPropagation()} aria-label="Open complaint" className="grid size-11 place-items-center rounded-full hover:bg-slate-100">
                    <ChevronRight className="size-5" />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
    </>
  );
}

export default function ComplaintsPage() {
  return (
    <RequireAuth permission={Permission.COMPLAINT_VIEW}>
      <Suspense><ComplaintsScreen /></Suspense>
    </RequireAuth>
  );
}
