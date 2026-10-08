'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import {
  can,
  formatPaise,
  MEAL_KEYS,
  MEAL_LABELS,
  Permission,
  type DashboardOverview,
  type ExpectedMeals,
  type MenuStatusToday,
  type Role,
} from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { longDate } from '@/lib/menu';

const MENU_STATUS: Record<MenuStatusToday, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  PUBLISHED: { label: 'Published', tone: 'success' },
  DRAFT: { label: 'Draft — not visible to students', tone: 'warning' },
  NOT_CREATED: { label: 'Not created', tone: 'danger' },
};

const linkClass = 'inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold hover:bg-canvas';
const primaryLinkClass = 'inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700';

function quickActions(role: Role | undefined) {
  return [
    { label: 'Scan QR', href: '/attendance/scan', permission: Permission.ATTENDANCE_MARK, primary: true },
    { label: 'Attendance', href: '/attendance', permission: Permission.ATTENDANCE_VIEW },
    { label: 'Add student', href: '/students/new', permission: Permission.STUDENT_MANAGE },
    { label: 'Record payment', href: '/payments?record=1', permission: Permission.PAYMENT_RECORD },
    { label: 'Add expense', href: '/expenses?add=1', permission: Permission.EXPENSE_MANAGE },
    { label: "Edit today's menu", href: '/menu', permission: Permission.MENU_MANAGE },
    { label: 'View dues', href: '/payments/dues', permission: Permission.FINANCE_VIEW },
    { label: 'View complaints', href: '/complaints?status=OPEN', permission: Permission.COMPLAINT_VIEW },
  ].filter((a) => can(role, a.permission));
}

function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: string; tone?: 'danger' | 'success' }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={tone === 'danger' ? 'text-2xl font-bold text-danger' : tone === 'success' ? 'text-2xl font-bold text-success' : 'text-2xl font-bold'}>{value}</dd>
      {note && <dd className="text-xs text-ink-muted">{note}</dd>}
    </div>
  );
}

function MealsCard({ title, description, counts, today, action }: { title: string; description: string; counts: ExpectedMeals; today: boolean; action: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <dl className="grid grid-cols-3 gap-3">
        {MEAL_KEYS.map((key) => {
          const m = counts.meals[key];
          return (
            <div key={key}>
              <dt className="text-sm text-ink-muted">{MEAL_LABELS[key]}</dt>
              <dd className="text-2xl font-bold">{m.expected}</dd>
              <dd className="text-xs text-ink-muted">expected · {m.paused} paused</dd>
              {today && <dd className="text-xs text-ink-muted">{m.served} served · {m.remaining} left</dd>}
            </div>
          );
        })}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">{action}</div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy aria-label="Loading dashboard">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10" />
          <Skeleton className="h-6 w-3/4" />
        </Card>
      ))}
    </div>
  );
}

function Overview({ data, role }: { data: DashboardOverview; role: Role | undefined }) {
  const { meals, menu, money, students, subscriptions, complaints, feedback, actionItems } = data;
  const status = MENU_STATUS[menu.status];
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="today-h">
        <h2 id="today-h" className="mb-3 text-lg font-semibold">Today · {longDate(data.dates.today)}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <MealsCard
            title="Meals today"
            description="Students on a plan, minus pauses"
            counts={meals.today}
            today
            action={can(role, Permission.ATTENDANCE_VIEW) && <Link href="/attendance" className={linkClass}>View attendance</Link>}
          />
          <div className="grid gap-4">
            <Card>
              <CardHeader title="Today's menu" action={<Badge tone={status.tone}>{status.label}</Badge>} />
              <Link href="/menu" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                {menu.status === 'NOT_CREATED' ? 'Create menu' : can(role, Permission.MENU_MANAGE) ? 'Edit menu' : 'View menu'} →
              </Link>
            </Card>
            {students && (
              <Card>
                <dl className="grid grid-cols-3 gap-3">
                  <Stat label="Active students" value={students.active} />
                  <Stat label="Inactive" value={students.inactive} />
                  <Stat label="Joined this month" value={students.joinedThisMonth} />
                </dl>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="tomorrow-h">
        <h2 id="tomorrow-h" className="mb-3 text-lg font-semibold">Tomorrow · {longDate(data.dates.tomorrow)}</h2>
        <MealsCard
          title="Tomorrow's meals"
          description="Plan the cooking: valid plans minus pauses"
          counts={meals.tomorrow}
          today={false}
          action={can(role, Permission.PAUSE_VIEW) && <Link href={`/pauses?from=${data.dates.tomorrow}`} className={linkClass}>See who paused</Link>}
        />
      </section>

      {money && (
        <section aria-labelledby="money-h">
          <h2 id="money-h" className="mb-3 text-lg font-semibold">Money</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Collected" />
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Today" value={formatPaise(money.collectedTodayPaise)} />
                <Stat label="This month" value={formatPaise(money.collectedThisMonthPaise)} />
                <Stat label="Pending dues" value={formatPaise(money.pendingDuesPaise)} tone={money.pendingDuesPaise > 0 ? 'danger' : undefined} />
                <Stat label="Students owing" value={money.studentsWithDues} />
              </dl>
            </Card>
            <Card>
              <CardHeader title="Spent" />
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Today" value={formatPaise(money.expensesTodayPaise)} />
                <Stat label="This month" value={formatPaise(money.expensesThisMonthPaise)} />
                <div className="col-span-2">
                  <Stat
                    label="Estimated operating balance (this month)"
                    value={formatPaise(money.balance.netPaise)}
                    tone={money.balance.netPaise < 0 ? 'danger' : 'success'}
                    note="Collected minus expenses. Not accounting profit; unpaid dues are not counted."
                  />
                </div>
              </dl>
            </Card>
          </div>
        </section>
      )}

      {(subscriptions || complaints || feedback || actionItems.length > 0) && (
        <section aria-labelledby="attention-h">
          <h2 id="attention-h" className="mb-3 text-lg font-semibold">Needs attention</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="To do" />
              {actionItems.length === 0 ? (
                <p className="flex min-h-11 items-center gap-2 text-sm text-ink-muted"><CheckCircle2 className="size-5 text-success" aria-hidden /> Nothing needs attention right now.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {actionItems.map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} className="flex min-h-12 items-center gap-3 hover:bg-canvas">
                        <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        {item.key !== 'MENU_NOT_PUBLISHED' && <Badge tone="warning">{item.count}</Badge>}
                        <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="grid gap-4">
              {subscriptions && (
                <Card>
                  <CardHeader title="Plans" />
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Active" value={subscriptions.active} />
                    <Stat label="Starting soon" value={subscriptions.upcoming} />
                    <Stat label="Ending in 7 days" value={subscriptions.expiringSoon} tone={subscriptions.expiringSoon > 0 ? 'danger' : undefined} />
                    <Stat label="Ended, not renewed" value={subscriptions.endedWithoutRenewal} note="last 7 days" />
                  </dl>
                </Card>
              )}
              {(complaints || feedback) && (
                <Card>
                  <CardHeader title="Feedback & complaints" />
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {feedback && (
                      <Stat label="Avg rating" value={feedback.monthAverage == null ? '—' : `${feedback.monthAverage.toFixed(1)}★`} note={`${feedback.monthCount} this month`} />
                    )}
                    {complaints && (
                      <>
                        <Stat label="Open complaints" value={complaints.OPEN} tone={complaints.OPEN > 0 ? 'danger' : undefined} />
                        <Stat label="In progress" value={complaints.IN_PROGRESS} />
                        <Stat label="Resolved" value={complaints.resolvedThisMonth} note="this month" />
                      </>
                    )}
                  </dl>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    setData(null);
    api<DashboardOverview>('/dashboard').then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [attempt]);

  if (!session?.membership) return null;
  const actions = quickActions(session.role);

  return (
    <>
      <PageHeader title={`Welcome, ${session.user.firstName}!`} description={session.membership.mess.name} />
      {actions.length > 0 && (
        <nav aria-label="Quick actions" className="mb-6 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className={a.primary ? primaryLinkClass : linkClass}>{a.label}</Link>
          ))}
        </nav>
      )}
      {error ? (
        <ErrorState title="Couldn't load the dashboard" description={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <Overview data={data} role={session.role} />
      )}
    </>
  );
}
