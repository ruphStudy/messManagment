'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  ADMIN_RECORD_TYPES,
  FOOD_TYPE_LABELS,
  formatPaise,
  MEAL_KEYS,
  MEAL_LABELS,
  MESS_TYPE_LABELS,
  REPORT_INFO,
  ROLE_LABELS,
  type AdminMessDetail,
  type AdminRecordType,
} from '@mess/shared';
import { ActivityList } from '@/components/admin/activity-list';
import { BillingPanel } from '@/components/admin/billing-panel';
import { Avatar } from '@/components/ui/avatar';
import { ListResult } from '@/components/admin/list-result';
import { StatGrid } from '@/components/admin/stat-grid';
import { StatusChangeDialog } from '@/components/admin/status-change-dialog';
import { ReportTable } from '@/components/reports/report-table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { MESS_STATUS_UI } from '@/lib/admin';
import { formatTimestampDate, formatDateTime } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function Info({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
      ))}
    </dl>
  );
}

/** Read-only record views (same data as the owner's reports). */
function Records({ messId }: { messId: string }) {
  const list = useListParams({ records: 'students' });
  const type = (ADMIN_RECORD_TYPES as readonly string[]).includes(list.get('records')) ? (list.get('records') as AdminRecordType) : 'students';
  const q = new URLSearchParams({ page: String(list.page), pageSize: '20' });
  if (list.search) q.set('search', list.search);
  const { result, error, retry } = usePagedList<unknown>(`/admin/messes/${messId}/records/${type}?${q}`);
  return (
    <Card>
      <CardHeader title="Records (read-only)" description={type === 'attendance' ? 'Last 7 days' : REPORT_INFO[type].description} />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {ADMIN_RECORD_TYPES.map((t) => (
          <Button key={t} size="sm" role="tab" aria-selected={t === type} variant={t === type ? 'primary' : 'secondary'} onClick={() => list.setParams({ records: t, page: 1 })}>
            {REPORT_INFO[t].title}
          </Button>
        ))}
      </div>
      <div className="mb-3 max-w-sm"><SearchInput label="Search" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student…" /></div>
      <ListResult result={result} error={error} retry={retry} onPage={(p) => list.setParams({ page: p })} filtered={!!list.search} noMatch="No matching records." empty={{ title: 'No records yet.' }}>
        {(rows) => <ReportTable type={type} rows={rows} />}
      </ListResult>
    </Card>
  );
}

function MessDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminMessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null);

  useEffect(() => {
    setError(null);
    api<AdminMessDetail>(`/admin/messes/${id}`).then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [id, attempt]);

  if (error) return <ErrorState title="Couldn't load this mess" description={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <div className="flex flex-col gap-4" aria-busy>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const { mess, owner } = data;
  const status = MESS_STATUS_UI[mess.status];
  const suspended = mess.status === 'SUSPENDED';
  return (
    <>
      <Link href="/admin/messes" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> All messes</Link>
      <PageHeader
        title={mess.name}
        description={`${mess.city}, ${mess.state} · since ${formatTimestampDate(mess.createdAt)}`}
        actions={
          suspended ? <Button onClick={() => setDialog('reactivate')}>Reactivate mess</Button> : <Button variant="danger" onClick={() => setDialog('suspend')}>Suspend mess</Button>
        }
      />
      <div className="mb-4 flex items-center gap-2"><span className="text-sm text-ink-muted">Status</span><Badge tone={status.tone}>{status.label}</Badge></div>
      {data.suspension && (
        <Alert tone="danger" className="mb-4">
          Suspended {formatDateTime(data.suspension.at)} by {data.suspension.by}{data.suspension.reason && <> — “{data.suspension.reason}”</>}. The team can only view records; students cannot pause, give feedback or get a meal QR.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Basic info" />
          <Info
            rows={[
              ['Type', `${MESS_TYPE_LABELS[mess.messType]} · ${FOOD_TYPE_LABELS[mess.foodType]}`],
              ['Phone', mess.mobile],
              ['Email', mess.email ?? '—'],
              ['Address', `${mess.address}, ${mess.city}, ${mess.state} ${mess.pincode}`],
              ['Hours', mess.openingTime && mess.closingTime ? `${mess.openingTime}–${mess.closingTime}` : '—'],
              ['Meals', MEAL_KEYS.filter((k) => mess.meals[k]).map((k) => MEAL_LABELS[k]).join(', ') || '—'],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Owner" />
          <Info
            rows={[
              ['Name', <Link key="o" href={`/admin/users/${owner.id}`} className="font-medium text-brand-700 hover:underline">{owner.name}</Link>],
              ['Mobile', owner.mobile],
              ['Email', owner.email ?? '—'],
              ['Account', owner.status === 'ACTIVE' ? 'Active' : 'Suspended'],
              ['Last sign-in', owner.lastLoginAt ? formatDateTime(owner.lastLoginAt) : 'Never'],
            ]}
          />
          <h3 className="mb-1 mt-4 text-sm font-semibold">Team ({data.team.length})</h3>
          <ul className="text-sm">
            {data.team.map((t) => (
              <li key={t.id} className="flex min-h-9 items-center gap-2">
                <Avatar name={t.name} className="size-7" />
                <Link href={`/admin/users/${t.id}`} className="text-brand-700 hover:underline">{t.name}</Link>
                <span className="text-ink-muted">{ROLE_LABELS[t.role]}{t.status !== 'ACTIVE' && ' · removed'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-semibold">Usage</h2>
      <StatGrid
        items={[
          { label: 'Active students', value: data.students.active, note: `${data.students.total} total · ${data.students.appLinked} on the app` },
          { label: 'Active subscriptions', value: data.subscriptions.active, note: `${data.subscriptions.expiringSoon} ending within 7 days` },
          { label: 'Meals served today', value: data.attendance.today.total, note: MEAL_KEYS.map((k) => `${MEAL_LABELS[k]} ${data.attendance.today[k]}`).join(' · ') },
          { label: 'Meals served (7 days)', value: data.attendance.last7Days },
        ]}
      />

      <h2 className="mb-3 mt-6 text-lg font-semibold">This month (read-only)</h2>
      <StatGrid
        items={[
          { label: 'Collected', value: formatPaise(data.finance.collectedPaise) },
          { label: 'Expenses', value: formatPaise(data.finance.expensesPaise) },
          { label: 'Estimated balance', value: formatPaise(data.finance.netPaise), note: 'Collected − expenses' },
          { label: 'Pending dues', value: formatPaise(data.finance.pendingDuesPaise) },
          { label: 'Open complaints', value: data.complaints.OPEN, tone: data.complaints.OPEN ? 'danger' : undefined, href: `/admin/complaints?messId=${mess.id}&status=OPEN` },
          { label: 'In progress', value: data.complaints.IN_PROGRESS, href: `/admin/complaints?messId=${mess.id}&status=IN_PROGRESS` },
          { label: 'Resolved', value: data.complaints.RESOLVED },
        ]}
      />

      <div className="mt-6 grid gap-4">
        <BillingPanel messId={mess.id} />
        <Records messId={mess.id} />
        <Card>
          <CardHeader title="Recent admin activity" action={<Link href={`/admin/audit?messId=${mess.id}`} className="text-sm font-medium text-brand-700 hover:underline">All →</Link>} />
          <ActivityList items={data.recentActivity} empty="No admin actions on this mess yet." />
        </Card>
      </div>

      <StatusChangeDialog<AdminMessDetail>
        open={!!dialog}
        mode={dialog ?? 'suspend'}
        title={dialog === 'reactivate' ? `Reactivate ${mess.name}?` : `Suspend ${mess.name}?`}
        impact={
          dialog === 'reactivate'
            ? 'The owner, team and students get normal access again.'
            : 'The owner and team can only view records (no changes, QR scans, payments or expenses). Students cannot pause meals, give feedback or get a meal QR. No data is deleted.'
        }
        path={`/admin/messes/${mess.id}`}
        onClose={() => setDialog(null)}
        onDone={(updated) => { setData(updated); setDialog(null); }}
      />
    </>
  );
}

export default function AdminMessDetailPage() {
  return <Suspense><MessDetailScreen /></Suspense>;
}
