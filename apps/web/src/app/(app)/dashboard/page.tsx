'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { addDays, businessToday, MEAL_KEYS, startOfWeek, MEAL_LABELS, Role, type MealPlan, type MenuDay } from '@mess/shared';
import { MenuStatusBadge } from '@/components/menu/menu-status-badge';
import { mealSummary } from '@/lib/menu';
import { api, apiEnvelope } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-context';

interface SetupCounts {
  students: number;
  plans: number;
  subscriptions: number;
  publishedDays: number;
}

/** Small counts for the setup checklist (one row per list is enough to read the total). */
function useSetupCounts() {
  const [counts, setCounts] = useState<SetupCounts | null>(null);
  useEffect(() => {
    const total = (path: string) => apiEnvelope<unknown[]>(path).then((res) => res.meta?.total ?? 0);
    const week = startOfWeek(businessToday());
    Promise.all([
      total('/students?pageSize=1'),
      api<MealPlan[]>('/meal-plans?status=ACTIVE'),
      total('/subscriptions?pageSize=1'),
      api<MenuDay[]>(`/menus?from=${week}&to=${addDays(week, 6)}`),
    ])
      .then(([students, plans, subscriptions, menuDays]) =>
        setCounts({ students, plans: plans.length, subscriptions, publishedDays: menuDays.filter((d) => d.menu?.isPublished).length }),
      )
      .catch(() => setCounts(null));
  }, []);
  return counts;
}

function TodayMenuCard() {
  const [day, setDay] = useState<MenuDay | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<MenuDay>(`/menus/${businessToday()}`).then(setDay).catch(() => setFailed(true));
  }, []);

  return (
    <Card className="md:col-span-5">
      <CardHeader title="Today's menu" action={day && <MenuStatusBadge menu={day.menu} />} />
      {failed ? (
        <p className="text-sm text-ink-muted">Couldn&apos;t load today&apos;s menu.</p>
      ) : !day ? (
        <div className="h-12 animate-pulse rounded bg-slate-100" />
      ) : day.menu ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {MEAL_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-ink-muted">{MEAL_LABELS[key]}</dt>
              <dd className="line-clamp-2 font-medium">{mealSummary(day.menu![key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">No menu created for today yet.</p>
      )}
      <Link href="/menu" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
        {day?.menu ? 'Edit menu' : 'Create menu'} →
      </Link>
    </Card>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
  const counts = useSetupCounts();
  if (!session?.membership) return null;

  const CHECKLIST = [
    { label: 'Create your account', done: true },
    { label: 'Set up your mess profile', done: true, href: '/settings' },
    { label: 'Add your students', done: !!counts?.students, href: '/students', note: counts?.students ? `${counts.students} added` : undefined },
    { label: 'Create meal plans', done: !!counts?.plans, href: '/meal-plans', note: counts?.plans ? `${counts.plans} active` : undefined },
    {
      label: 'Assign plans to students',
      done: !!counts?.subscriptions,
      href: '/subscriptions',
      note: counts?.subscriptions ? `${counts.subscriptions} assigned` : undefined,
    },
    {
      label: 'Publish this week’s menu',
      done: counts?.publishedDays === 7,
      href: '/menu/week',
      note: counts ? `${counts.publishedDays}/7 days` : undefined,
    },
  ];
  const isOwner = session.role === Role.MESS_OWNER;

  return (
    <>
      <PageHeader title={`Welcome, ${session.user.firstName}!`} description={session.membership.mess.name} />

      <div className="grid gap-4 md:grid-cols-5">
        <TodayMenuCard />
        <Card className="md:col-span-3">
          <CardHeader
            title="Getting started"
            description={isOwner ? 'Your mess is set up. More tools are on the way.' : 'Your mess workspace is ready.'}
          />
          <ul className="flex flex-col gap-1">
            {CHECKLIST.map(({ label, done, href, note }) => (
              <li key={label} className="flex min-h-11 items-center gap-3">
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="size-5 shrink-0 text-slate-300" aria-label="Not done" />
                )}
                <span className={done ? 'text-ink' : 'text-ink-muted'}>
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </span>
                {note && <span className="ml-auto text-xs text-ink-muted">{note}</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Setup status" />
          <p className="text-3xl font-bold text-brand-700">
            {CHECKLIST.filter((c) => c.done).length}/{CHECKLIST.length}
          </p>
          <p className="mt-1 text-sm text-ink-muted">steps completed</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${(CHECKLIST.filter((c) => c.done).length / CHECKLIST.length) * 100}%` }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
