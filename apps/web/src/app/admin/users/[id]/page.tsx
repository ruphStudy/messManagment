'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ROLE_LABELS, STUDENT_STATUS_LABELS, type AdminUserDetail } from '@mess/shared';
import { ActivityList } from '@/components/admin/activity-list';
import { StatusChangeDialog } from '@/components/admin/status-change-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { MESS_STATUS_UI, USER_STATUS_UI } from '@/lib/admin';
import { formatDate, formatTimestampDate, formatDateTime } from '@/lib/format';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null);

  useEffect(() => {
    setError(null);
    api<AdminUserDetail>(`/admin/users/${id}`).then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [id, attempt]);

  if (error) return <ErrorState title="Couldn't load this user" description={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <div className="flex flex-col gap-4" aria-busy>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const { user } = data;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '(no name yet)';
  const suspended = user.status === 'DISABLED';
  const messLink = (messId: string, messName: string) => <Link href={`/admin/messes/${messId}`} className="font-medium text-brand-700 hover:underline">{messName}</Link>;

  return (
    <>
      <Link href="/admin/users" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> All users</Link>
      <PageHeader
        title={name}
        description={`${ROLE_LABELS[user.role]} · joined ${formatTimestampDate(user.createdAt)}`}
        actions={
          data.canChangeStatus &&
          (suspended ? <Button onClick={() => setDialog('reactivate')}>Reactivate account</Button> : <Button variant="danger" onClick={() => setDialog('suspend')}>Suspend account</Button>)
        }
      />
      <div className="mb-4 flex items-center gap-2"><span className="text-sm text-ink-muted">Account</span><Badge tone={USER_STATUS_UI[user.status].tone}>{USER_STATUS_UI[user.status].label}</Badge></div>
      {data.suspension && (
        <Alert tone="danger" className="mb-4">
          Suspended {formatDateTime(data.suspension.at)} by {data.suspension.by}{data.suspension.reason && <> — “{data.suspension.reason}”</>}. This person cannot sign in.
        </Alert>
      )}
      {!data.canChangeStatus && <p className="mb-4 text-sm text-ink-muted">Platform admin accounts (including yours) can’t be suspended here.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {([
              ['Mobile', `${user.mobile}${user.mobileVerified ? ' (verified)' : ''}`],
              ['Email', user.email ? `${user.email}${user.emailVerified ? ' (verified)' : ''}` : '—'],
              ['Role', ROLE_LABELS[user.role]],
              ['Last sign-in', user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'],
              ['Updated', formatDateTime(user.updatedAt)],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Messes" />
          {data.memberships.length + data.studentRecords.length + data.ownedMesses.length === 0 ? (
            <p className="text-sm text-ink-muted">Not linked to any mess.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.memberships.map((m) => (
                <li key={`m-${m.messId}`}>
                  {messLink(m.messId, m.messName)} · {ROLE_LABELS[m.role]}{m.status !== 'ACTIVE' && ' (removed)'} · since {formatTimestampDate(m.since)}{' '}
                  {m.messStatus !== 'ACTIVE' && <Badge tone={MESS_STATUS_UI[m.messStatus].tone}>{MESS_STATUS_UI[m.messStatus].label}</Badge>}
                </li>
              ))}
              {data.ownedMesses.filter((o) => !data.memberships.some((m) => m.messId === o.id)).map((o) => (
                <li key={`o-${o.id}`}>{messLink(o.id, o.name)} · Owner</li>
              ))}
              {data.studentRecords.map((s) => (
                <li key={`s-${s.id}`}>{messLink(s.messId, s.messName)} · Student ({STUDENT_STATUS_LABELS[s.status]}) · joined {formatDate(s.joiningDate)}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Recent activity" />
        <ActivityList items={data.recentActivity} empty="No admin actions involving this account." />
      </Card>

      <StatusChangeDialog<AdminUserDetail>
        open={!!dialog}
        mode={dialog ?? 'suspend'}
        title={dialog === 'reactivate' ? `Reactivate ${name}?` : `Suspend ${name}?`}
        impact={dialog === 'reactivate' ? 'They can sign in again. Their data was kept.' : 'They are signed out everywhere and cannot sign in. Nothing is deleted; their mess keeps working.'}
        path={`/admin/users/${user.id}`}
        onClose={() => setDialog(null)}
        onDone={(updated) => { setData(updated); setDialog(null); }}
      />
    </>
  );
}
