'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ScrollText, X } from 'lucide-react';
import { AUDIT_ACTION_LABELS, AuditTargetType, type AuditLogItem } from '@mess/shared';
import { ListResult } from '@/components/admin/list-result';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { formatDateTime } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const FILTERS = ['action', 'targetType', 'messId', 'actorUserId', 'targetId', 'from', 'to'];

const targetHref = (a: AuditLogItem) => (a.targetType === AuditTargetType.MESS ? `/admin/messes/${a.targetId}` : `/admin/users/${a.targetId}`);

function AuditScreen() {
  const list = useListParams();
  const q = new URLSearchParams({ page: String(list.page), pageSize: '25' });
  for (const k of FILTERS) if (list.get(k)) q.set(k, list.get(k));
  const { result, error, retry } = usePagedList<AuditLogItem>(`/admin/audit?${q}`);
  const filtered = FILTERS.some((k) => list.get(k));

  return (
    <>
      <PageHeader title="Activity / Audit" description="Platform admin actions, newest first" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <Select id="action" label="Action" options={[{ value: '', label: 'All actions' }, ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label }))]} value={list.get('action')} onChange={(e) => list.setParams({ action: e.target.value, page: 1 })} />
        <Select id="targetType" label="Target" options={[{ value: '', label: 'Messes and users' }, { value: AuditTargetType.MESS, label: 'Messes' }, { value: AuditTargetType.USER, label: 'Users' }]} value={list.get('targetType')} onChange={(e) => list.setParams({ targetType: e.target.value, page: 1 })} />
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
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={filtered} noMatch="No matching activity." empty={{ title: 'No admin activity yet.', icon: ScrollText }}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(a) => a.id}
            columns={[
              { header: 'Time', cell: (a) => formatDateTime(a.createdAt), className: 'whitespace-nowrap' },
              { header: 'Admin', cell: (a) => <Link href={`/admin/audit?actorUserId=${a.actor.id}`} className="text-brand-700 hover:underline">{a.actor.name}</Link> },
              { header: 'Action', cell: (a) => AUDIT_ACTION_LABELS[a.action] ?? a.action },
              { header: 'Target', cell: (a) => <Link href={targetHref(a)} className="text-brand-700 hover:underline">{a.targetLabel ?? a.targetType}</Link> },
              { header: 'Reason / details', cell: (a) => a.reason ?? '—' },
              { header: 'Mess', cell: (a) => (a.mess ? <Link href={`/admin/messes/${a.mess.id}`} className="text-brand-700 hover:underline">{a.mess.name}</Link> : '—') },
            ]}
          />
        )}
      </ListResult>
    </>
  );
}

export default function AdminAuditPage() {
  return <Suspense><AuditScreen /></Suspense>;
}
