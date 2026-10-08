'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { SystemStatus } from '@mess/shared';
import { StatGrid } from '@/components/admin/stat-grid';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const PUSH_LABELS = { expo: 'Expo push service', log: 'Log only (development)', disabled: 'Disabled (in-app only)' } as const;

function Row({ label, ok, value }: { label: string; ok?: boolean; value: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-border last:border-0">
      {ok === undefined ? <span className="size-5" /> : ok ? <CheckCircle2 className="size-5 text-success" aria-label="OK" /> : <XCircle className="size-5 text-danger" aria-label="Problem" />}
      <span className="flex-1 text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

const uptime = (s: number) => (s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} days`);

/** Informational only: modes and booleans, never configuration values or secrets. */
export default function AdminSystemPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api<SystemStatus>('/admin/system').then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [attempt]);

  return (
    <>
      <PageHeader title="System" description="Safe, read-only status of the platform" actions={<Button variant="secondary" onClick={() => { setData(null); setAttempt((n) => n + 1); }}>Refresh</Button>} />
      {error ? (
        <ErrorState title="Couldn't load system status" description={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Status" description={`Checked ${formatDateTime(data.checkedAt)}`} />
            <Row label="API" ok value={`Running · version ${data.version} · up ${uptime(data.uptimeSeconds)}`} />
            <Row label="Environment" value={data.environment} />
            <Row label="Database" ok={data.database.reachable} value={data.database.reachable ? `Reachable (${data.database.latencyMs} ms)` : 'Not reachable'} />
            <Row label="Push notifications" ok={data.push.provider === 'expo'} value={`${PUSH_LABELS[data.push.provider]}${data.push.provider === 'expo' ? (data.push.accessTokenConfigured ? ' · access token set' : ' · no access token') : ''}`} />
            <Row label="SMS / OTP" ok={data.sms.provider !== 'console' || data.environment !== 'production'} value={data.sms.provider === 'console' ? 'Console (development)' : data.sms.provider} />
            <Row label="Daily reminder scheduler" ok={data.scheduler.enabled} value={data.scheduler.enabled ? 'Enabled' : 'Disabled'} />
            <Row label="File storage" value="Local disk" />
          </Card>
          {data.storage.warning && <Alert tone="info">{data.storage.warning}</Alert>}
          <StatGrid
            items={[
              { label: 'Notifications sent', value: data.notifications.total },
              { label: 'Push failures (7 days)', value: data.notifications.pushFailedLast7Days, tone: data.notifications.pushFailedLast7Days ? 'danger' : undefined },
              { label: 'Registered devices', value: data.notifications.activeDevices },
            ]}
          />
        </div>
      )}
    </>
  );
}
