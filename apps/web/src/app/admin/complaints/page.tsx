'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { MessageSquareWarning, X } from 'lucide-react';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, type AdminComplaintItem } from '@mess/shared';
import { ListResult } from '@/components/admin/list-result';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { formatDateTime, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const FILTERS = ['status', 'category', 'messId', 'from', 'to'];

function ComplaintsScreen() {
  const list = useListParams();
  const q = new URLSearchParams({ page: String(list.page), pageSize: '25' });
  for (const k of FILTERS) if (list.get(k)) q.set(k, list.get(k));
  if (list.search) q.set('search', list.search);
  const { result, error, retry } = usePagedList<AdminComplaintItem>(`/admin/complaints?${q}`);
  const filtered = !!list.search || FILTERS.some((k) => list.get(k));
  const messName = list.get('messId') && result?.data[0]?.mess.name;

  return (
    <>
      <PageHeader title="Complaints" description={messName ? `Complaints at ${messName}` : 'Complaints across all messes (read-only)'} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
        <SearchInput label="Search" value={list.searchInput} onChange={list.setSearchInput} placeholder="Student name or mobile…" />
        <Select id="status" label="Status" options={[{ value: '', label: 'All' }, ...Object.entries(COMPLAINT_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} value={list.get('status')} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
        <Select id="category" label="Category" options={[{ value: '', label: 'All categories' }, ...Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} value={list.get('category')} onChange={(e) => list.setParams({ category: e.target.value, page: 1 })} />
        {(['from', 'to'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label htmlFor={k} className="text-sm font-medium">{k === 'from' ? 'From' : 'To'}</label>
            <input id={k} type="date" value={list.get(k)} onChange={(e) => list.setParams({ [k]: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
          </div>
        ))}
      </div>
      {filtered && (
        <button onClick={() => list.clear(FILTERS)} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><X className="size-4" aria-hidden /> Clear filters</button>
      )}
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={filtered} noMatch="No matching complaints." empty={{ title: 'No complaints on the platform yet.', icon: MessageSquareWarning }}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            rowHref={(c) => `/admin/complaints/${c.id}`}
            columns={[
              { header: 'Created', cell: (c) => formatDateTime(c.createdAt), className: 'whitespace-nowrap' },
              { header: 'Mess', cell: (c) => <Link href={`/admin/messes/${c.mess.id}`} className="relative z-10 text-brand-700 hover:underline">{c.mess.name}</Link> },
              { header: 'Student', cell: (c) => fullName(c.student) },
              { header: 'Category', cell: (c) => COMPLAINT_CATEGORY_LABELS[c.category] },
              { header: 'Status', cell: (c) => <ComplaintStatusBadge status={c.status} /> },
              { header: 'Description', cell: (c) => <span className="line-clamp-2 max-w-72">{c.description}</span> },
            ]}
          />
        )}
      </ListResult>
    </>
  );
}

export default function AdminComplaintsPage() {
  return <Suspense><ComplaintsScreen /></Suspense>;
}
