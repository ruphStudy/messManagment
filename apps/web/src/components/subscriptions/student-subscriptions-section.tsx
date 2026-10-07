'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  Permission,
  StudentStatus,
  SubscriptionStatus,
  type StudentDetail,
  type SubscriptionSummary,
} from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, fullName } from '@/lib/format';
import { SubscriptionStatusBadge } from './subscription-badges';
import { SubscriptionDialog, type SubscriptionDialogMode } from './subscription-dialog';
import { SubscriptionOverview } from './subscription-overview';

/** Current plan, what's lined up next and past plans for one student. Full management lives on /subscriptions. */
export function StudentSubscriptionsSection({ student }: { student: StudentDetail }) {
  const { session } = useAuth();
  const [subs, setSubs] = useState<SubscriptionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SubscriptionDialogMode | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<SubscriptionSummary[]>(`/students/${student.id}/subscriptions`)
      .then(setSubs)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [student.id]);
  useEffect(load, [load]);

  const canManage = can(session?.role, Permission.SUBSCRIPTION_MANAGE) && student.status === StudentStatus.ACTIVE;
  const current = subs?.find((s) => s.status === SubscriptionStatus.ACTIVE);
  const upcoming = (subs ?? []).filter((s) => s.status === SubscriptionStatus.UPCOMING).reverse();
  const past = (subs ?? []).filter((s) => s.status === SubscriptionStatus.EXPIRED || s.status === SubscriptionStatus.CANCELLED);
  // Renew/change act on the latest scheduled term (current, or the last upcoming one).
  const latest = upcoming.at(-1) ?? current;
  const name = fullName(student);

  const actions = canManage && subs && (
    <div className="flex flex-wrap gap-2">
      {latest ? (
        <>
          <Button size="sm" variant="secondary" onClick={() => setDialog('renew')}>Renew</Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog('change')}>Change plan</Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setDialog('assign')}>Assign plan</Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader title="Meal plan" action={actions} />
      {error ? (
        <ErrorState title="Couldn't load plans" description={error} onRetry={load} />
      ) : !subs ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          {current ? (
            <SubscriptionOverview sub={current} />
          ) : (
            <p className="text-ink-muted">
              {upcoming.length ? 'No active plan right now.' : 'No meal plan assigned yet.'}
              {student.status !== StudentStatus.ACTIVE && ' Activate this student to assign a plan.'}
            </p>
          )}

          {upcoming.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium">Coming up</p>
              {upcoming.map((s) => <SubscriptionOverview key={s.id} sub={s} />)}
            </div>
          )}

          {past.length > 0 && (
            <details className="border-t border-border pt-3">
              <summary className="min-h-9 cursor-pointer text-sm font-medium">Previous plans ({past.length})</summary>
              <ul className="mt-2 divide-y divide-border">
                {past.map((s) => (
                  <li key={s.id}>
                    <Link href={`/subscriptions/${s.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 hover:bg-canvas">
                      <span className="font-medium">{s.plan.name}</span>
                      <span className="flex items-center gap-2 text-sm text-ink-muted">
                        {formatDate(s.startDate)} – {formatDate(s.endDate)} <SubscriptionStatusBadge status={s.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {dialog && (
        <SubscriptionDialog
          open
          mode={dialog}
          studentId={student.id}
          studentName={name}
          current={dialog === 'assign' ? undefined : latest}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </Card>
  );
}
