'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { can, formatPaise, Permission, SubscriptionStatus, type PaymentRecord, type StudentDetail, type SubscriptionSummary } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, fullName } from '@/lib/format';
import { PaymentStatusBadge } from './payment-badges';
import { RecentPayments } from './recent-payments';
import { RecordPaymentDialog } from './record-payment-dialog';

/** Fee status of the current plan and anything else still owed, plus recent payments. */
export function StudentPaymentsSection({ student }: { student: StudentDetail }) {
  const { session } = useAuth();
  const canRecord = can(session?.role, Permission.PAYMENT_RECORD);
  const [subs, setSubs] = useState<SubscriptionSummary[] | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [recording, setRecording] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api<SubscriptionSummary[]>(`/students/${student.id}/subscriptions`),
      api<PaymentRecord[]>(`/payments?studentId=${student.id}&pageSize=5`),
    ])
      .then(([all, recent]) => {
        // Current plan, upcoming ones, and any older plan with money still due.
        setSubs(all.filter((s) => s.status !== SubscriptionStatus.CANCELLED && (s.status !== SubscriptionStatus.EXPIRED || s.payment.duePaise > 0)));
        setPayments(recent);
      })
      .catch(() => setSubs([]));
  }, [student.id]);
  useEffect(load, [load]);

  const totalDue = (subs ?? []).reduce((sum, s) => sum + s.payment.duePaise, 0);

  return (
    <Card>
      <CardHeader
        title="Fees"
        description={subs ? (totalDue ? `${formatPaise(totalDue)} due in total` : 'Nothing due') : undefined}
        action={canRecord && totalDue > 0 && <Button size="sm" onClick={() => setRecording(true)}>Record payment</Button>}
      />
      {!subs ? (
        <Skeleton className="h-16" />
      ) : (
        <>
          {subs.length === 0 ? (
            <p className="text-ink-muted">No current plan.</p>
          ) : (
            <ul className="mb-3 divide-y divide-border">
              {subs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link href={`/subscriptions/${s.id}`} className="font-semibold hover:underline">{s.plan.name}</Link>
                  <span className="text-sm text-ink-muted">{formatDate(s.startDate)} – {formatDate(s.endDate)}</span>
                  <PaymentStatusBadge status={s.payment.status} />
                  <span className="ml-auto text-sm">
                    Fee {formatPaise(s.payment.payablePaise)} · Paid {formatPaise(s.payment.paidPaise)} · <strong className={s.payment.duePaise ? 'text-danger' : ''}>Due {formatPaise(s.payment.duePaise)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-1 text-sm font-medium">Recent payments</p>
          <RecentPayments payments={payments} showPlan />
        </>
      )}
      <RecordPaymentDialog open={recording} student={{ id: student.id, name: fullName(student) }} onClose={() => setRecording(false)} onDone={() => { setRecording(false); load(); }} />
    </Card>
  );
}
