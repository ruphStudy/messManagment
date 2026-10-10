'use client';

import { useState } from 'react';
import { businessToday, formatPaise, mealsLabel, planRequestStatusText, type MealPlan, type PlanRequestItem } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';

const TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral' } as const;

/** Active plans of the selected mess; choosing one sends a request the mess approves (nothing is activated or paid here). */
export function ChoosePlan() {
  const toast = useToast();
  const plans = useApi<MealPlan[]>('/students/me/plans');
  const requests = useApi<PlanRequestItem[]>('/students/me/plan-requests');
  const [picked, setPicked] = useState<MealPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = requests.data?.find((r) => r.status === 'PENDING');

  const send = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api('/students/me/plan-requests', { method: 'POST', body: { mealPlanId: picked.id } });
      toast.success('Request sent to your mess');
      setPicked(null);
      await requests.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (id: string) => {
    try {
      await api(`/students/me/plan-requests/${id}/cancel`, { method: 'POST' });
      await requests.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {requests.data && requests.data.length > 0 && (
        <Card>
          <CardHeader title="My plan requests" />
          <ul className="flex flex-col divide-y divide-border">
            {requests.data.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">{r.planName} · {formatPaise(r.planPricePaise)} <span className="text-xs text-ink-muted">· {formatDateTime(r.createdAt)}</span>{r.rejectReason && <span className="block text-xs text-ink-muted">“{r.rejectReason}”</span>}</span>
                <Badge tone={TONE[r.status]}>{planRequestStatusText(r, businessToday(), formatDate)}</Badge>
                {r.status === 'PENDING' && <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)}>Withdraw</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Available plans" description={pending ? 'Your request is waiting for your mess. Withdraw it to choose a different plan.' : 'Choose a plan — your mess confirms it and you pay at the mess as usual.'} />
        {plans.error ? (
          <p className="text-sm text-danger">{plans.error}</p>
        ) : !plans.data ? (
          <Skeleton className="h-24" />
        ) : !plans.data.length ? (
          <p className="text-ink-muted">Your mess has no plans available right now.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {plans.data.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-card border border-border p-4">
                <p className="font-semibold">{p.name}</p>
                <p className="text-2xl font-bold">₹{p.price}</p>
                <p className="text-sm text-ink-muted">{mealsLabel(p)} · {p.durationValue} {p.durationType === 'DAYS' ? 'day(s)' : 'month(s)'} · {p.mealCredits ? `${p.mealCredits}-meal pack` : 'unlimited meals'}</p>
                {p.description && <p className="text-sm">{p.description}</p>}
                <div className="mt-2"><Button size="sm" disabled={!!pending} onClick={() => setPicked(p)}>Choose plan</Button></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={!!picked}
        title={picked ? `Request ${picked.name}?` : ''}
        description="Your mess will confirm it. The plan starts once approved (after your current plan, if any). Pay at the mess as usual."
        confirmLabel="Send request"
        loading={busy}
        onConfirm={send}
        onCancel={() => setPicked(null)}
      />
    </div>
  );
}
