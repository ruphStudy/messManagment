'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, UserCog, X } from 'lucide-react';
import { can, Permission, Role, ROLE_LABELS, STAFF_STATUS_LABELS, type StaffListItem } from '@mess/shared';
import { ListResult } from '@/components/admin/list-result';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';
import { formatDate, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const FILTERS = ['role', 'status'];
const addLink = 'inline-flex min-h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700';

function StaffScreen() {
  const { session } = useAuth();
  const canManage = can(session?.role, Permission.STAFF_MANAGE);
  const list = useListParams();
  const q = new URLSearchParams({ page: String(list.page), pageSize: '25' });
  for (const k of FILTERS) if (list.get(k)) q.set(k, list.get(k));
  if (list.search) q.set('search', list.search);
  const { result, error, retry } = usePagedList<StaffListItem>(`/staff?${q}`);
  const filtered = !!list.search || FILTERS.some((k) => list.get(k));
  const onlyOwner = !filtered && result && result.meta.total > 0 && result.data.every((m) => m.role === Role.MESS_OWNER);

  return (
    <>
      <PageHeader title="Staff" description="Your team and what they can access" actions={canManage && <Link href="/staff/new" className={addLink}><Plus className="size-4" aria-hidden /> Add staff</Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <SearchInput label="Search team" value={list.searchInput} onChange={list.setSearchInput} placeholder="Name, mobile or email…" />
        <Select id="role" label="Role" options={[{ value: '', label: 'All roles' }, ...[Role.MESS_OWNER, Role.MESS_MANAGER, Role.MESS_STAFF].map((r) => ({ value: r, label: ROLE_LABELS[r] }))]} value={list.get('role')} onChange={(e) => list.setParams({ role: e.target.value, page: 1 })} />
        <Select id="status" label="Status" options={[{ value: '', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} value={list.get('status')} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
      </div>
      {filtered && (
        <button onClick={() => list.clear(FILTERS)} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><X className="size-4" aria-hidden /> Clear filters</button>
      )}
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={filtered} noMatch="No team members match your filters." empty={{ title: 'No staff members added yet.', icon: UserCog }}>
        {(rows) => (
          <>
            <DataTable
              rows={rows}
              rowKey={(m) => m.id}
              rowHref={(m) => `/staff/${m.id}`}
              columns={[
                { header: 'Name', cell: (m) => <>{fullName(m)}{m.isSelf && ' (you)'}</> },
                { header: 'Mobile / email', cell: (m) => <>{m.mobile}{m.email && <span className="block text-xs text-ink-muted">{m.email}</span>}</> },
                { header: 'Role', cell: (m) => ROLE_LABELS[m.role] },
                { header: 'Status', cell: (m) => <Badge tone={m.status === 'ACTIVE' ? 'success' : 'neutral'}>{STAFF_STATUS_LABELS[m.status]}</Badge> },
                { header: 'Added', cell: (m) => formatDate(m.addedAt), className: 'whitespace-nowrap' },
              ]}
            />
            {onlyOwner && (
              <div className="mt-4">
                <EmptyState icon={UserCog} title="No staff members added yet." description="Add a manager for day-to-day work or staff to serve meals." action={canManage && <Link href="/staff/new" className={addLink}>Add Staff</Link>} />
              </div>
            )}
          </>
        )}
      </ListResult>
    </>
  );
}

export default function StaffPage() {
  return (
    <RequireAuth permission={Permission.STAFF_VIEW}>
      <Suspense><StaffScreen /></Suspense>
    </RequireAuth>
  );
}
