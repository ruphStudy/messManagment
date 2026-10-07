'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { Role, type MealPlan } from '@mess/shared';
import { api, apiEnvelope } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-context';

interface SetupCounts {
  students: number;
  plans: number;
  subscriptions: number;
}

/** Small counts for the setup checklist (one row per list is enough to read the total). */
function useSetupCounts() {
  const [counts, setCounts] = useState<SetupCounts | null>(null);
  useEffect(() => {
    const total = (path: string) => apiEnvelope<unknown[]>(path).then((res) => res.meta?.total ?? 0);
    Promise.all([total('/students?pageSize=1'), api<MealPlan[]>('/meal-plans?status=ACTIVE'), total('/subscriptions?pageSize=1')])
      .then(([students, plans, subscriptions]) => setCounts({ students, plans: plans.length, subscriptions }))
      .catch(() => setCounts(null));
  }, []);
  return counts;
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
    { label: 'Publish your weekly menu', done: false, note: 'Coming soon' },
  ];
  const isOwner = session.role === Role.MESS_OWNER;

  return (
    <>
      <PageHeader title={`Welcome, ${session.user.firstName}!`} description={session.membership.mess.name} />

      <div className="grid gap-4 md:grid-cols-5">
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
