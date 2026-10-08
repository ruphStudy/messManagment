'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { formatPaise, type AdminDashboard } from '@mess/shared';
import { StatGrid } from '@/components/admin/stat-grid';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { longDate } from '@/lib/menu';

const QUICK_LINKS = [
  { label: 'View messes', href: '/admin/messes' },
  { label: 'Suspended messes', href: '/admin/messes?status=SUSPENDED' },
  { label: 'Search users', href: '/admin/users' },
  { label: 'Open complaints', href: '/admin/complaints?status=OPEN' },
  { label: 'View audit', href: '/admin/audit' },
  { label: 'System status', href: '/admin/system' },
];

function Overview({ d }: { d: AdminDashboard }) {
  const trend = d.complaints.newLast7Days - d.complaints.newPrevious7Days;
  const attention = [
    d.messes.suspended > 0 && { label: `${d.messes.suspended} suspended ${d.messes.suspended === 1 ? 'mess' : 'messes'}`, href: '/admin/messes?status=SUSPENDED' },
    d.complaints.open > 0 && { label: `${d.complaints.open} open complaints across messes`, href: '/admin/complaints?status=OPEN' },
    d.notifications.pushFailedLast7Days > 0 && { label: `${d.notifications.pushFailedLast7Days} push notifications failed in the last 7 days`, href: '/admin/system' },
    d.users.disabled > 0 && { label: `${d.users.disabled} suspended user accounts`, href: '/admin/users?status=DISABLED' },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="overview-h">
        <h2 id="overview-h" className="mb-3 text-lg font-semibold">Platform overview</h2>
        <StatGrid
          items={[
            { label: 'Total messes', value: d.messes.total, href: '/admin/messes' },
            { label: 'Active messes', value: d.messes.active, href: '/admin/messes?status=ACTIVE' },
            { label: 'New messes this month', value: d.messes.newThisMonth },
            { label: 'Students (active)', value: d.students.active, note: `${d.students.total} total · ${d.students.newThisMonth} new this month` },
            { label: 'Owners', value: d.users.owners, href: '/admin/users?role=MESS_OWNER' },
            { label: 'Managers / staff', value: `${d.users.managers} / ${d.users.staff}` },
            { label: 'Student app accounts', value: d.users.studentAccounts, note: `${d.students.unlinked} students not yet on the app` },
          ]}
        />
      </section>

      <section aria-labelledby="usage-h">
        <h2 id="usage-h" className="mb-3 text-lg font-semibold">Usage · {longDate(d.dates.today)}</h2>
        <StatGrid
          items={[
            { label: 'Meals served today', value: d.usage.mealsServedToday, note: `${d.usage.activeMessesToday} messes serving` },
            { label: 'Meals served (7 days)', value: d.usage.mealsServedLast7Days, note: `${d.usage.activeMessesLast7Days} messes serving` },
            { label: 'Active subscriptions', value: d.usage.activeSubscriptions, note: `${d.usage.expiringSubscriptions} ending within 7 days` },
            { label: 'Payments this month', value: d.usage.paymentsThisMonth.count, note: `${formatPaise(d.usage.paymentsThisMonth.amountPaise)} recorded` },
          ]}
        />
      </section>

      <section aria-labelledby="attention-h" className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Attention needed" />
          {attention.length === 0 ? (
            <p className="flex min-h-11 items-center gap-2 text-sm text-ink-muted">
              <CheckCircle2 className="size-5 text-success" aria-hidden /> No suspended messes and no open complaints requiring attention.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {attention.map((a) => (
                <li key={a.href}><Link href={a.href} className="flex min-h-11 items-center font-medium text-brand-700 hover:underline">{a.label} →</Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Complaints" />
          <StatGrid
            className="sm:grid-cols-2 lg:grid-cols-2"
            items={[
              { label: 'Open', value: d.complaints.open, tone: d.complaints.open ? 'danger' : undefined, href: '/admin/complaints?status=OPEN' },
              { label: 'In progress', value: d.complaints.inProgress, href: '/admin/complaints?status=IN_PROGRESS' },
              {
                label: 'New (last 7 days)',
                value: d.complaints.newLast7Days,
                note: trend === 0 ? 'Same as the week before' : `${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)} vs the week before`,
              },
            ]}
          />
        </Card>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    setData(null);
    api<AdminDashboard>('/admin/dashboard').then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [attempt]);

  return (
    <>
      <PageHeader title="Platform dashboard" description="All messes at a glance" />
      <nav aria-label="Quick links" className="mb-6 flex flex-wrap gap-2">
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-semibold hover:bg-canvas">{l.label}</Link>
        ))}
      </nav>
      {error ? (
        <ErrorState title="Couldn't load the dashboard" description={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <Overview d={data} />
      )}
    </>
  );
}
