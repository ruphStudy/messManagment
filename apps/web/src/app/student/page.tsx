'use client';

import Link from 'next/link';
import { Bell, ChevronRight, Star, Wallet } from 'lucide-react';
import {
  formatPaise,
  formatTime12,
  istClockTime,
  MEAL_KEYS,
  MEAL_LABELS,
  mealAtTime,
  remainingMeals,
  servingWindow,
  STUDENT_STATUS_LABELS,
  StudentStatus,
  type EligibleMeal,
  type MySubscriptionResponse,
  type StudentFeesResponse,
  type StudentMeResponse,
  type StudentMenuResponse,
  type StudentPauseSettings,
  type TodayMealState,
} from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { SubscriptionCard } from '@/components/student/student-ui';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';

const MEAL_STATE: Record<Exclude<TodayMealState, 'NOT_INCLUDED'>, { label: string; tone: 'success' | 'brand' | 'info' }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'brand' },
  SERVED: { label: 'Served ✓', tone: 'info' },
};

const rowLink = 'flex min-h-12 items-center gap-3 rounded-card border border-border bg-surface px-4 font-medium hover:border-brand-300';

function TodayMenu({ data }: { data: StudentMenuResponse | null }) {
  if (!data?.linked) return null;
  const day = data.days[0];
  const now = istClockTime();
  const served = MEAL_KEYS.filter((k) => data.servedMeals[k]);
  const current = mealAtTime(data.servingTimes, served, now);
  const upcoming = remainingMeals(data.servingTimes, served, now).slice(0, 2);
  return (
    <Card>
      <CardHeader title="Today's menu" action={<Link href="/student/menu" className="text-sm font-medium text-brand-700 hover:underline">Full menu</Link>} />
      {!day?.menu ? (
        <p className="text-ink-muted">Today&apos;s menu has not been published yet.</p>
      ) : upcoming.length === 0 ? (
        <p className="text-ink-muted">No more meals today.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {upcoming.map((k) => {
            const meal = day.menu![k];
            return (
              <li key={k}>
                <span className="font-semibold">
                  {MEAL_LABELS[k]} {current?.meal === k && current.state === 'CURRENT' ? '(serving now)' : `(${formatTime12(servingWindow(data.servingTimes, k).start)})`}:
                </span>{' '}
                {!meal.available ? `${MEAL_LABELS[k]} unavailable` : meal.items.join(', ') || 'Items not listed'}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Dashboard() {
  const profile = useApi<StudentMeResponse>('/students/me');
  const sub = useApi<MySubscriptionResponse>('/students/me/subscription');
  const menu = useApi<StudentMenuResponse>('/students/me/menu/today');
  const pause = useApi<StudentPauseSettings>('/students/me/pause-settings');
  const fees = useApi<StudentFeesResponse>('/students/me/fees');
  const toRate = useApi<EligibleMeal[]>('/students/me/feedback/eligible-meals');
  const unread = useApi<{ count: number }>('/notifications/unread-count');

  if (profile.error) return <ErrorState title="Couldn't load your details" description={profile.error} onRetry={profile.reload} />;
  if (!profile.data) return <div className="flex flex-col gap-4" aria-busy>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!profile.data.linked) return null; // LinkedOnly handles this; profile may lag one refresh behind.
  const p = profile.data.profile;
  const pauseInfo = pause.data?.linked ? pause.data : null;
  const todayMeals = pauseInfo ? MEAL_KEYS.filter((k) => pauseInfo.todayMeals[k] !== 'NOT_INCLUDED') : [];
  const rate = toRate.data?.[0];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Hi, ${p.firstName}!`} description={`${p.mess.name} · member since ${formatDate(p.joiningDate)}`} />
      {p.status === StudentStatus.INACTIVE && <Alert tone="danger">Your membership is {STUDENT_STATUS_LABELS[p.status].toLowerCase()}. Please contact your mess.</Alert>}

      {pauseInfo && todayMeals.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Today's meals">
          {todayMeals.map((k) => {
            const s = MEAL_STATE[pauseInfo.todayMeals[k] as Exclude<TodayMealState, 'NOT_INCLUDED'>];
            return <Badge key={k} tone={s.tone}>{MEAL_LABELS[k]} · {s.label}</Badge>;
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TodayMenu data={menu.data} />
        <div className="flex flex-col gap-2">
          {rate && <Link href="/student/feedback" className={rowLink}><Star className="size-5 text-amber-400" aria-hidden /><span className="flex-1">Rate your recent {MEAL_LABELS[rate.mealType].toLowerCase()}</span><ChevronRight className="size-4 text-ink-muted" aria-hidden /></Link>}
          {fees.data?.linked && fees.data.subscriptions.length > 0 && (
            <Link href="/student/payments" className={rowLink}>
              <Wallet className={fees.data.totalDuePaise ? 'size-5 text-danger' : 'size-5 text-success'} aria-hidden />
              <span className={fees.data.totalDuePaise ? 'flex-1 text-danger' : 'flex-1 text-success'}>{fees.data.totalDuePaise ? `Due: ${formatPaise(fees.data.totalDuePaise)}` : 'Fees paid in full'}</span>
              <ChevronRight className="size-4 text-ink-muted" aria-hidden />
            </Link>
          )}
          <Link href="/student/notifications" className={rowLink}>
            <Bell className="size-5 text-brand-600" aria-hidden />
            <span className="flex-1">{unread.data?.count ? `${unread.data.count} unread notification${unread.data.count === 1 ? '' : 's'}` : 'Notifications'}</span>
            <ChevronRight className="size-4 text-ink-muted" aria-hidden />
          </Link>
          <Link href="/student/pause" className={rowLink}><span className="flex-1">Pause a meal</span><ChevronRight className="size-4 text-ink-muted" aria-hidden /></Link>
        </div>
      </div>

      <h2 className="mt-2 text-lg font-semibold">Your plan</h2>
      {sub.error ? (
        <ErrorState title="Couldn't load your plan" description={sub.error} onRetry={sub.reload} />
      ) : !sub.data ? (
        <Skeleton className="h-40" />
      ) : sub.data.linked && (sub.data.current || sub.data.upcoming) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sub.data.current && <SubscriptionCard sub={sub.data.current} />}
          {sub.data.upcoming && <SubscriptionCard sub={sub.data.upcoming} />}
        </div>
      ) : (
        <Card>
          <p className="font-semibold">No meal plan yet</p>
          <p className="text-ink-muted">Choose one of your mess&apos;s plans, or ask your mess to assign one.</p>
          <Link href="/student/plans" className="mt-2 inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Choose a plan</Link>
        </Card>
      )}
      <Link href="/student/plans" className="text-sm font-medium text-brand-700 hover:underline">Plans & history →</Link>
    </div>
  );
}

export default function StudentHomePage() {
  const { session } = useAuth();
  return (
    <>
      {!session?.student?.linked && <PageHeader title={`Hi${session?.user.firstName ? `, ${session.user.firstName}` : ''}!`} description="Welcome to MessMate" />}
      <LinkedOnly>
        <Dashboard />
      </LinkedOnly>
    </>
  );
}
