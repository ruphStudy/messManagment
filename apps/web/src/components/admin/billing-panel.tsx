'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BILLING_CYCLE_LABELS,
  BillingCycle,
  billingHeadline,
  billingPeriodLabel,
  formatPaise,
  parseRupeesToPaise,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  PLATFORM_TRIAL_DAYS,
  PlatformSubscriptionStatus,
  type ActivatePlatformSubscriptionRequest,
  type AdminBillingDetail,
} from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/loader';
import { Select } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { BILLING_STATUS_TONE } from '@/lib/admin';
import { formatDate, formatTimestampDate } from '@/lib/format';

const EMPTY = { planName: 'MessMate Standard', billingCycle: BillingCycle.MONTHLY as BillingCycle, amount: '', startDate: '', endDate: '', paymentReference: '', notes: '' };

/** Platform admin: MessMate (SaaS) subscription — manual payments, optional 15-day trial, history. Separate from mess suspension. */
export function BillingPanel({ messId }: { messId: string }) {
  const toast = useToast();
  const [data, setData] = useState<AdminBillingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const load = useCallback(() => {
    setError(null);
    api<AdminBillingDetail>(`/admin/messes/${messId}/billing`).then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [messId]);
  useEffect(load, [load]);

  const run = async (key: string, path: string, body: unknown, done: string) => {
    setBusy(key);
    try {
      setData(await api<AdminBillingDetail>(`/admin/messes/${messId}/billing/${path}`, { method: 'POST', body }));
      toast.success(done);
      setShowForm(false);
      setForm(EMPTY);
      setNotes('');
    } catch (e) {
      toast.error('Not saved', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState title="Couldn't load billing" description={error} onRetry={load} />;
  if (!data) return <Card><Skeleton className="h-24 w-full" /></Card>;

  const head = billingHeadline(data, formatDate);
  const paidActive = data.accessAllowed && data.status === PlatformSubscriptionStatus.ACTIVE;
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitActivate = () => {
    const amountPaise = parseRupeesToPaise(form.amount || '0');
    if (amountPaise == null) return toast.error('Enter a valid amount');
    const body: ActivatePlatformSubscriptionRequest = {
      planName: form.planName,
      billingCycle: form.billingCycle,
      amountPaise,
      ...(form.startDate ? { startDate: form.startDate } : {}),
      ...(form.endDate ? { endDate: form.endDate } : {}),
      ...(form.paymentReference ? { paymentReference: form.paymentReference } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    };
    void run('activate', 'activate', body, paidActive ? 'Subscription renewed' : 'Subscription activated');
  };
  const changeStatus = (status: 'EXPIRED' | 'SUSPENDED') => {
    if (!window.confirm(status === 'EXPIRED' ? 'Mark this subscription as expired? Mess changes will be blocked.' : 'Suspend MessMate access? Mess changes will be blocked.')) return;
    void run(status, 'status', { status, ...(notes ? { notes } : {}) }, `Marked ${PLATFORM_SUBSCRIPTION_STATUS_LABELS[status].toLowerCase()}`);
  };

  return (
    <Card>
      <CardHeader title="MessMate subscription" description="Recorded manually after payment outside the app." action={<Badge tone={BILLING_STATUS_TONE[data.status]}>{PLATFORM_SUBSCRIPTION_STATUS_LABELS[data.status]}</Badge>} />
      <p className="mb-3 text-sm font-medium">{head.text}</p>
      {data.upcoming.length > 0 && <p className="mb-2 text-sm text-ink-muted">Upcoming: {data.upcoming.map((u) => `${u.planName} (${billingPeriodLabel(u, formatDate, formatPaise)})`).join('; ')}</p>}
      {data.current && (
        <p className="mb-4 text-sm text-ink-muted">
          {data.current.planName}
          {data.current.billingCycle ? ` · ${BILLING_CYCLE_LABELS[data.current.billingCycle]}` : ''}
          {data.current.amountPaise ? ` · ${formatPaise(data.current.amountPaise)}` : ''}
          {data.current.paymentReference ? ` · Ref ${data.current.paymentReference}` : ''}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setShowForm((v) => !v)}>{paidActive ? 'Renew / extend' : 'Activate (paid)'}</Button>
        <Button variant="secondary" disabled={paidActive} loading={busy === 'trial'} onClick={() => void run('trial', 'trial', notes ? { notes } : {}, `${PLATFORM_TRIAL_DAYS}-day trial granted`)}>
          Grant {PLATFORM_TRIAL_DAYS}-day trial
        </Button>
        <Button variant="secondary" loading={busy === 'EXPIRED'} onClick={() => changeStatus('EXPIRED')}>Mark expired</Button>
        <Button variant="danger" loading={busy === 'SUSPENDED'} onClick={() => changeStatus('SUSPENDED')}>Suspend access</Button>
      </div>
      {!showForm && <Input id="billing-notes" label="Note for trial / status change (optional)" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="mb-4" />}

      {showForm && (
        <div className="mb-4 grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
          <Input id="plan-name" label="Plan name" required maxLength={80} value={form.planName} onChange={set('planName')} />
          <Select id="cycle" label="Billing cycle" options={Object.values(BillingCycle).map((c) => ({ value: c, label: BILLING_CYCLE_LABELS[c] }))} value={form.billingCycle} onChange={set('billingCycle')} />
          <Input id="amount" label="Amount paid (₹)" inputMode="decimal" value={form.amount} onChange={set('amount')} />
          <Input id="reference" label="Payment reference" maxLength={120} value={form.paymentReference} onChange={set('paymentReference')} />
          <Input id="start" label="Start date" type="date" hint={paidActive || data.upcoming.length ? 'Default: day after the last paid period ends' : 'Default: today'} value={form.startDate} onChange={set('startDate')} />
          <Input id="end" label="End date" type="date" hint="Default: start + 1 month / 1 year" value={form.endDate} onChange={set('endDate')} />
          <Input id="notes" label="Notes" maxLength={300} value={form.notes} onChange={set('notes')} className="sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <Button loading={busy === 'activate'} disabled={!form.planName.trim()} onClick={submitActivate}>Save payment</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold">History</h3>
      <ul className="divide-y divide-border text-sm">
        {data.history.map((h) => {
          const from = h.status === 'TRIAL' ? h.trialStartDate : h.startDate;
          const to = h.status === 'TRIAL' ? h.trialEndDate : h.endDate;
          return (
            <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
              <Badge tone={BILLING_STATUS_TONE[h.status]}>{PLATFORM_SUBSCRIPTION_STATUS_LABELS[h.status]}</Badge>
              {h.phase !== 'PAST' && <Badge tone={h.phase === 'CURRENT' ? 'brand' : 'info'}>{h.phase === 'CURRENT' ? 'Current' : 'Upcoming'}</Badge>}
              <span className="font-medium">{h.planName}</span>
              {h.billingCycle && <span className="text-ink-muted">{BILLING_CYCLE_LABELS[h.billingCycle]}</span>}
              {h.amountPaise > 0 && <span>{formatPaise(h.amountPaise)}</span>}
              {from && to && <span className="text-ink-muted">{formatDate(from)} – {formatDate(to)}</span>}
              {h.paymentReference && <span className="text-ink-muted">Ref {h.paymentReference}</span>}
              {h.notes && <span className="w-full text-xs text-ink-muted">{h.notes}</span>}
              <span className="ml-auto text-xs text-ink-muted">{formatTimestampDate(h.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
