'use client';

import { Suspense } from 'react';
import { Building2, X } from 'lucide-react';
import { MESS_TYPE_LABELS, MessStatus, type AdminMessListItem } from '@mess/shared';
import { ListResult } from '@/components/admin/list-result';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { MESS_STATUS_UI } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const FILTERS = ['status', 'messType', 'sort'];
const SORTS: Record<string, [string, string]> = { newest: ['createdAt', 'desc'], oldest: ['createdAt', 'asc'], name: ['name', 'asc'], city: ['city', 'asc'] };

function MessesScreen() {
  const list = useListParams();
  const q = new URLSearchParams({ page: String(list.page), pageSize: '25' });
  for (const k of ['status', 'messType']) if (list.get(k)) q.set(k, list.get(k));
  if (list.search) q.set('search', list.search);
  const [sortBy, sortOrder] = SORTS[list.get('sort')] ?? SORTS.newest;
  q.set('sortBy', sortBy);
  q.set('sortOrder', sortOrder);
  const { result, error, retry } = usePagedList<AdminMessListItem>(`/admin/messes?${q}`);
  const filtered = !!list.search || FILTERS.some((k) => list.get(k));

  return (
    <>
      <PageHeader title="Messes" description="Every mess on the platform" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <SearchInput label="Search messes" value={list.searchInput} onChange={list.setSearchInput} placeholder="Mess, owner name/mobile/email, city…" />
        <Select id="status" label="Status" options={[{ value: '', label: 'All' }, { value: MessStatus.ACTIVE, label: 'Active' }, { value: MessStatus.SUSPENDED, label: 'Suspended' }]} value={list.get('status')} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
        <Select id="messType" label="Type" options={[{ value: '', label: 'All types' }, ...Object.entries(MESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} value={list.get('messType')} onChange={(e) => list.setParams({ messType: e.target.value, page: 1 })} />
        <Select id="sort" label="Sort" options={[{ value: '', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name A–Z' }, { value: 'city', label: 'City A–Z' }]} value={list.get('sort')} onChange={(e) => list.setParams({ sort: e.target.value, page: 1 })} />
      </div>
      {filtered && (
        <button onClick={() => list.clear(FILTERS)} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><X className="size-4" aria-hidden /> Clear filters</button>
      )}
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={filtered} noMatch="No matching messes." empty={{ title: 'No messes registered yet.', icon: Building2 }}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(m) => m.id}
            rowHref={(m) => `/admin/messes/${m.id}`}
            columns={[
              { header: 'Mess', cell: (m) => m.name },
              { header: 'Owner', cell: (m) => <>{m.owner.name}<span className="block text-xs text-ink-muted">{m.owner.mobile}</span></> },
              { header: 'City', cell: (m) => `${m.city}, ${m.state}` },
              { header: 'Type', cell: (m) => MESS_TYPE_LABELS[m.messType] },
              { header: 'Active students', cell: (m) => m.activeStudents, className: 'text-right' },
              { header: 'Status', cell: (m) => <Badge tone={MESS_STATUS_UI[m.status].tone}>{MESS_STATUS_UI[m.status].label}</Badge> },
              { header: 'Created', cell: (m) => formatDate(m.createdAt), className: 'whitespace-nowrap' },
            ]}
          />
        )}
      </ListResult>
    </>
  );
}

export default function AdminMessesPage() {
  return <Suspense><MessesScreen /></Suspense>;
}
