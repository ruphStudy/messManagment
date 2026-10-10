'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { BILLING_CYCLE_LABELS, billingHeadline, billingPeriodLabel, formatPaise, PLATFORM_SUBSCRIPTION_STATUS_LABELS, PLATFORM_TRIAL_DAYS, type PlatformBillingSummary } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';

const fmt = (d: string) => formatDate(d);

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value || '—'}</dd>
    </div>
  );
}

/** Owner/manager view of the mess's MessMate (SaaS) subscription — read-only, always reachable. */
export function BillingSummaryCard() {
  const [data, setData] = useState<PlatformBillingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session, reload } = useAuth();
  const load = useCallback(() => {
    setError(null);
    api<PlatformBillingSummary>('/billing').then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  // Activated/expired since sign-in → recheck the session so the app-wide banner matches.
  const stale = data && session?.billing && session.billing.accessAllowed !== data.accessAllowed;
  useEffect(() => {
    if (stale) void reload();
  }, [stale, reload]);

  if (error) return <ErrorState title="Couldn't load your subscription" description={error} onRetry={load} />;
  if (!data) return <Card><Skeleton className="mb-3 h-5 w-48" /><Skeleton className="h-24 w-full" /></Card>;

  const head = billingHeadline(data, fmt);
  const c = data.current;
  const trial = c?.trialStartDate && c.trialEndDate;
  const { email, phone } = data.support;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">MessMate subscription</h2>
          <Badge tone={head.tone}>{PLATFORM_SUBSCRIPTION_STATUS_LABELS[data.status]}</Badge>
        </div>
        <p className={head.tone === 'danger' ? 'mb-4 text-sm font-medium text-danger' : 'mb-4 text-sm font-medium'}>{head.text}</p>
        <dl>
          <Row label="Plan" value={c?.planName} />
          <Row label="Billing cycle" value={c?.billingCycle ? BILLING_CYCLE_LABELS[c.billingCycle] : null} />
          <Row label="Price" value={c?.amountPaise ? formatPaise(c.amountPaise) : null} />
          <Row label="Start date" value={c?.startDate ? fmt(c.startDate) : null} />
          <Row label="Expiry date" value={data.accessUntil ? fmt(data.accessUntil) : null} />
          <Row label="Days remaining" value={data.daysRemaining != null ? String(data.daysRemaining) : null} />
          {trial && <Row label={`Trial (${PLATFORM_TRIAL_DAYS} days)`} value={`${fmt(c.trialStartDate!)} – ${fmt(c.trialEndDate!)}`} />}
          <Row label="Payment reference" value={c?.paymentReference} />
        </dl>
      </Card>
      {data.upcoming.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Upcoming</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {data.upcoming.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Upcoming</Badge>
                <span className="font-medium">{u.planName}</span>
                <span className="text-ink-muted">{billingPeriodLabel(u, fmt, formatPaise)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="mb-1 font-semibold">Contact support</h2>
        <p className="mb-3 text-sm text-ink-muted">Payments are recorded by the MessMate team. Contact support to activate, renew or start a trial.</p>
        {email || phone ? (
          <div className="flex flex-wrap gap-2">
            {email && (
              <a href={`mailto:${email}?subject=${encodeURIComponent('MessMate subscription')}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white dark:text-canvas">
                <Mail className="size-4" aria-hidden /> {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold">
                <Phone className="size-4" aria-hidden /> {phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Support contact isn&apos;t configured yet.</p>
        )}
      </Card>
    </div>
  );
}
