'use client';

import { use, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, RefreshCw, Shuffle } from 'lucide-react';
import {
  can,
  mealsLabel,
  Permission,
  StudentStatus,
  SUBSCRIPTION_KIND_LABELS,
  SubscriptionStatus,
  type SubscriptionDetail,
} from '@mess/shared';
import { mealsLeftLabel, SubscriptionStatusBadge } from '@/components/subscriptions/subscription-badges';
import { SubscriptionDialog, type SubscriptionDialogMode } from '@/components/subscriptions/subscription-dialog';
import { SubscriptionPaymentCard } from '@/components/payments/subscription-payment-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatMobile, formatPrice, fullName } from '@/lib/format';

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="mt-0.5 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [dialog, setDialog] = useState<SubscriptionDialogMode | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<SubscriptionDetail>(`/subscriptions/${id}`)
      .then(setSub)
      .catch((e: unknown) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 }));
  }, [id]);
  useEffect(load, [load]);

  const back = (
    <Link href="/subscriptions" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> All subscriptions
    </Link>
  );
  if (error) {
    return (
      <>
        {back}
        {error.notFound ? <EmptyState title="Subscription not found" description="It does not exist or belongs to another mess." /> : <ErrorState description={error.message} onRetry={load} />}
      </>
    );
  }
  if (!sub) return <>{back}<PageLoader /></>;

  const live = sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.UPCOMING;
  const studentActive = sub.student.status === StudentStatus.ACTIVE;
  const canManage = can(session?.role, Permission.SUBSCRIPTION_MANAGE) && studentActive;
  const canCancel = can(session?.role, Permission.SUBSCRIPTION_CANCEL) && live;
  const name = fullName(sub.student);
  const planRenamed = sub.mealPlan && sub.mealPlan.name !== sub.plan.name;

  const cancel = async () => {
    setCancelling(true);
    try {
      setSub(await api<SubscriptionDetail>(`/subscriptions/${id}/cancel`, { method: 'POST' }));
      toast.success('Subscription cancelled', name);
      setConfirmCancel(false);
    } catch (e) {
      toast.error('Could not cancel', errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      {back}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display font-bold tracking-tight">{sub.plan.name}</h1>
            <SubscriptionStatusBadge status={sub.status} />
          </div>
          <Link href={`/students/${sub.student.id}`} className="mt-1 inline-flex min-h-11 items-center text-ink-muted hover:text-ink hover:underline">
            {name} · {formatMobile(sub.student.mobile)}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && sub.status !== SubscriptionStatus.CANCELLED && (
            <Button variant="secondary" onClick={() => setDialog('renew')}><RefreshCw className="size-4" aria-hidden /> Renew</Button>
          )}
          {canManage && live && (
            <Button variant="secondary" onClick={() => setDialog('change')}><Shuffle className="size-4" aria-hidden /> Change plan</Button>
          )}
          {canCancel && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmCancel(true)}><Ban className="size-4" aria-hidden /> Cancel</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Validity" />
          <Facts
            items={[
              ['Starts', formatDate(sub.startDate)],
              ['Ends', formatDate(sub.endDate)],
              ['Days left', sub.daysRemaining ?? '—'],
              ['Meals left', mealsLeftLabel(sub)],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Plan (as assigned)" description="Saved when assigned; later plan edits don't change it." />
          <Facts
            items={[
              ['Price', formatPrice(sub.plan.price)],
              ['Meals', mealsLabel(sub.plan)],
              ['Type', SUBSCRIPTION_KIND_LABELS[sub.kind]],
              ['Meal pack', sub.totalMealCredits === null ? 'Unlimited during validity' : `${sub.totalMealCredits} meals`],
            ]}
          />
          {planRenamed && <p className="mt-3 text-xs text-ink-muted">This plan is now called “{sub.mealPlan!.name}”.</p>}
        </Card>
      </div>

      <div className="mt-4">
        <SubscriptionPaymentCard sub={sub} student={{ id: sub.student.id, name }} onChanged={load} />
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Created {formatDateTime(sub.createdAt)}
        {sub.cancelledAt && ` · Cancelled ${formatDateTime(sub.cancelledAt)}`}
        {!studentActive && ' · Student is not active, so no new plans can be assigned'}
      </p>

      {dialog && (
        <SubscriptionDialog
          open
          mode={dialog}
          studentId={sub.student.id}
          studentName={name}
          current={sub}
          onClose={() => setDialog(null)}
          onDone={(created) => {
            setDialog(null);
            router.push(`/subscriptions/${created.id}`);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this subscription?"
        description={`${name}'s ${sub.plan.name} will be marked cancelled. It stays in their history. No refund is calculated.`}
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it"
        tone="danger"
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
