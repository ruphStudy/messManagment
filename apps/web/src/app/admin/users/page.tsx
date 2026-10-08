'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Users, X } from 'lucide-react';
import { Role, ROLE_LABELS, UserStatus, type AdminUserListItem } from '@mess/shared';
import { ListResult } from '@/components/admin/list-result';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { USER_STATUS_UI } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const FILTERS = ['role', 'status', 'messId'];

function UsersScreen() {
  const list = useListParams();
  const q = new URLSearchParams({ page: String(list.page), pageSize: '25' });
  for (const k of FILTERS) if (list.get(k)) q.set(k, list.get(k));
  if (list.search) q.set('search', list.search);
  const { result, error, retry } = usePagedList<AdminUserListItem>(`/admin/users?${q}`);
  const filtered = !!list.search || FILTERS.some((k) => list.get(k));

  return (
    <>
      <PageHeader title="Users" description="Owners, team members, student app accounts and admins" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <SearchInput label="Search users" value={list.searchInput} onChange={list.setSearchInput} placeholder="Name, mobile or email…" />
        <Select id="role" label="Role" options={[{ value: '', label: 'All roles' }, ...Object.values(Role).map((r) => ({ value: r, label: ROLE_LABELS[r] }))]} value={list.get('role')} onChange={(e) => list.setParams({ role: e.target.value, page: 1 })} />
        <Select id="status" label="Account" options={[{ value: '', label: 'All' }, { value: UserStatus.ACTIVE, label: 'Active' }, { value: UserStatus.DISABLED, label: 'Suspended' }]} value={list.get('status')} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
      </div>
      {filtered && (
        <button onClick={() => list.clear(FILTERS)} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><X className="size-4" aria-hidden /> Clear filters</button>
      )}
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={filtered} noMatch="No matching users." empty={{ title: 'No users yet.', icon: Users }}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(u) => u.id}
            rowHref={(u) => `/admin/users/${u.id}`}
            columns={[
              { header: 'Name', cell: (u) => u.name || '(no name yet)' },
              { header: 'Mobile / email', cell: (u) => <>{u.mobile}{u.email && <span className="block text-xs text-ink-muted">{u.email}</span>}</> },
              { header: 'Role', cell: (u) => ROLE_LABELS[u.role] },
              {
                header: 'Mess',
                cell: (u) =>
                  u.messes.length === 0 ? '—' : (
                    <span className="relative z-10 flex flex-col">
                      {u.messes.map((m) => <Link key={`${m.messId}-${m.role}`} href={`/admin/messes/${m.messId}`} className="text-brand-700 hover:underline">{m.messName}{m.role !== u.role && ` (${ROLE_LABELS[m.role]})`}</Link>)}
                    </span>
                  ),
              },
              { header: 'Account', cell: (u) => <Badge tone={USER_STATUS_UI[u.status].tone}>{USER_STATUS_UI[u.status].label}</Badge> },
              { header: 'Created', cell: (u) => formatDate(u.createdAt), className: 'whitespace-nowrap' },
            ]}
          />
        )}
      </ListResult>
    </>
  );
}

export default function AdminUsersPage() {
  return <Suspense><UsersScreen /></Suspense>;
}
