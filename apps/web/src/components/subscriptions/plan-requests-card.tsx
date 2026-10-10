'use client';

import { useCallback, useEffect, useState } from 'react';
import { can, formatPaise, PLAN_REQUEST_STATUS_LABELS, Permission, type PlanRequestItem } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, fullName } from '@/lib/format';
import { PersonName } from '@/components/ui/avatar';

/** Students' plan choices waiting for the mess. Approve = the normal "assign plan" (all its rules); reject keeps history. */
export function PlanRequestsCard({ onApproved }: { onApproved?: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const manage = can(session?.role, Permission.SUBSCRIPTION_MANAGE);
  const [items, setItems] = useState<PlanRequestItem[] | null>(null);
  const [acting, setActing] = useState<{ req: PlanRequestItem; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<PlanRequestItem[]>('/plan-requests?status=PENDING').then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);
  if (!items?.length) return null;

  const decide = async () => {
    if (!acting) return;
    setBusy(true);
    try {
      await api(`/plan-requests/${acting.req.id}/${acting.approve ? 'approve' : 'reject'}`, { method: 'POST', body: {} });
      toast.success(acting.approve ? 'Plan assigned' : 'Request rejected');
      setActing(null);
      load();
      if (acting.approve) onApproved?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 border-brand-200">
      <CardHeader title={`Plan requests (${items.length})`} description="Students chose these plans. Approving assigns the plan (payment is recorded separately, as usual)." />
      <ul className="flex flex-col divide-y divide-border">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <PersonName name={r.student ? fullName(r.student) : ''} className="font-medium">{r.student ? fullName(r.student) : ''} · {r.planName} · {formatPaise(r.planPricePaise)}</PersonName>
              <span className="block text-xs text-ink-muted">{r.student?.mobile} · requested {formatDateTime(r.createdAt)} <Badge tone="warning">{PLAN_REQUEST_STATUS_LABELS[r.status]}</Badge></span>
            </span>
            {manage && (
              <span className="flex gap-2">
                <Button size="sm" onClick={() => setActing({ req: r, approve: true })}>Approve</Button>
                <Button size="sm" variant="secondary" onClick={() => setActing({ req: r, approve: false })}>Reject</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!acting}
        title={acting?.approve ? `Assign ${acting.req.planName}?` : 'Reject this request?'}
        description={acting?.approve ? 'Starts today, or the day after their current plan ends. The fee is added to their dues.' : 'No plan is assigned. The student can choose again.'}
        confirmLabel={acting?.approve ? 'Approve' : 'Reject'}
        tone={acting?.approve ? 'primary' : 'danger'}
        loading={busy}
        onConfirm={decide}
        onCancel={() => setActing(null)}
      />
    </Card>
  );
}
