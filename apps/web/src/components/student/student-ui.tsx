'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Star, XCircle } from 'lucide-react';
import {
  daysBetween,
  DEFAULT_COUNTRY_CODE,
  formatPaise,
  MEAL_KEYS,
  MEAL_LABELS,
  PAYMENT_STATUS_LABELS,
  RATING_MAX,
  SUBSCRIPTION_STATUS_LABELS,
  SubscriptionStatus,
  type MealKey,
  type PublishedMenu,
  type SubscriptionPaymentStatus,
  type SubscriptionSummary,
} from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Shown when the account is valid but no mess has added this mobile yet (same wording as the app). */
export function NotLinkedCard({ mobile, action }: { mobile: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <Clock className="size-8 text-warning" aria-hidden />
      <p className="font-semibold">Your account is ready, but your mess has not added this mobile number yet.</p>
      <p className="text-sm text-ink-muted">
        Ask your mess owner to add {DEFAULT_COUNTRY_CODE} {mobile} as a student. You&apos;ll be connected automatically — no need to sign up again.
      </p>
      {action && <div>{action}</div>}
    </Card>
  );
}

const SUB_TONE: Record<SubscriptionStatus, 'success' | 'info' | 'neutral' | 'danger'> = { ACTIVE: 'success', UPCOMING: 'info', EXPIRED: 'neutral', CANCELLED: 'danger' };
export function SubStatus({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={SUB_TONE[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</Badge>;
}

const PAY_TONE: Record<SubscriptionPaymentStatus, 'success' | 'warning' | 'danger'> = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger' };
export function PayStatus({ status }: { status: SubscriptionPaymentStatus }) {
  return <Badge tone={PAY_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-medium"><span>{label}</span><span>{value} / {total}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label}>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Current or upcoming plan: validity, included meals and what's left. */
export function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  const totalDays = daysBetween(sub.startDate, sub.endDate) + 1;
  const included: [MealKey, boolean][] = [['breakfast', sub.plan.breakfastIncluded], ['lunch', sub.plan.lunchIncluded], ['dinner', sub.plan.dinnerIncluded]];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><p className="flex-1 text-lg font-semibold">{sub.plan.name}</p><SubStatus status={sub.status} /></div>
      <p className="text-sm text-ink-muted">{sub.status === SubscriptionStatus.UPCOMING ? 'Starts' : 'Valid from'} {formatDate(sub.startDate)} to {formatDate(sub.endDate)}</p>
      <ul className="flex flex-wrap gap-4 text-sm">
        {included.filter(([k, on]) => on || k !== 'breakfast').map(([k, on]) => (
          <li key={k} className={cn('flex items-center gap-1', !on && 'text-ink-muted')}>
            {on ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4" aria-hidden />} {MEAL_LABELS[k]}
            <span className="sr-only">{on ? 'included' : 'not included'}</span>
          </li>
        ))}
      </ul>
      {sub.totalMealCredits !== null ? <Progress label="Meals left" value={sub.remainingMealCredits ?? 0} total={sub.totalMealCredits} /> : <p className="text-sm font-medium">Unlimited meals during validity</p>}
      {sub.daysRemaining !== null && <Progress label="Days left" value={sub.daysRemaining} total={totalDays} />}
    </Card>
  );
}

/** Total fee / Paid / Due for one subscription. */
export function FeeCard({ sub }: { sub: SubscriptionSummary }) {
  const { payablePaise, paidPaise, duePaise, status } = sub.payment;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-semibold">{sub.plan.name}</p><SubStatus status={sub.status} /><PayStatus status={status} /></div>
      <p className="text-sm text-ink-muted">{formatDate(sub.startDate)} – {formatDate(sub.endDate)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div><dt className="text-xs text-ink-muted">Total fee</dt><dd className="font-semibold">{formatPaise(payablePaise)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Paid</dt><dd className="font-semibold text-success">{formatPaise(paidPaise)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Due</dt><dd className={cn('font-semibold', duePaise > 0 && 'text-danger')}>{formatPaise(duePaise)}</dd></div>
      </dl>
    </Card>
  );
}

/** Meals to show: the ones the mess serves, plus any with items that day. */
export function visibleMeals(menu: PublishedMenu, served: Record<MealKey, boolean>): MealKey[] {
  return MEAL_KEYS.filter((k) => served[k] || (menu[k].available && menu[k].items.length > 0));
}

export function DayMenu({ menu, served, dayLabel, timing }: { menu: PublishedMenu | null; served: Record<MealKey, boolean>; dayLabel: string; timing?: (k: MealKey) => string }) {
  if (!menu) return <EmptyState title={`${dayLabel} menu has not been published yet.`} description="Check back later." />;
  return (
    <div className="flex flex-col gap-3">
      {menu.generalNote && <Card className="border-brand-200 bg-brand-50 text-brand-700">{menu.generalNote}</Card>}
      {visibleMeals(menu, served).map((k) => {
        const meal = menu[k];
        return (
          <Card key={k} className={cn(!meal.available && 'bg-canvas')}>
            <CardHeader title={MEAL_LABELS[k]} action={timing && <span className="text-sm text-ink-muted">{timing(k)}</span>} />
            {!meal.available ? (
              <p className="font-semibold text-ink-muted">{MEAL_LABELS[k]} unavailable</p>
            ) : meal.items.length ? (
              <ul className="list-inside list-disc">{meal.items.map((i) => <li key={i}>{i}</li>)}</ul>
            ) : (
              <p className="text-ink-muted">Items not listed</p>
            )}
            {meal.note && <p className="mt-1 text-sm text-ink-muted">{meal.note}</p>}
          </Card>
        );
      })}
    </div>
  );
}

/** 1–5 stars, each a full-size button. */
export function StarInput({ label, value, onChange, large }: { label: string; value: number | null; onChange: (v: number) => void; large?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex gap-1">
        {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => {
          const on = value !== null && n <= value;
          return (
            <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={value === n} className="grid size-11 place-items-center rounded-control hover:bg-canvas">
              <Star className={cn(large ? 'size-8' : 'size-6', on ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} aria-hidden />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
