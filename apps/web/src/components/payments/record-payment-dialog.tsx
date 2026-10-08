'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  businessToday,
  formatPaise,
  METHODS_WITH_REFERENCE,
  PAYMENT_LIMITS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  paiseToInput,
  parseRupeesToPaise,
  SubscriptionStatus,
  type PaymentRecord,
  type StudentListItem,
  type SubscriptionSummary,
} from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/loader';
import { Modal } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage, isAbortError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatMobile, fullName } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounce';
import { PaymentStatusBadge } from './payment-badges';

interface Props {
  open: boolean;
  /** Preselected student; otherwise the dialog searches for one. */
  student?: { id: string; name: string };
  /** Preselected subscription. */
  subscriptionId?: string;
  onClose: () => void;
  onDone: (payment: PaymentRecord) => void;
}

/** Fast payment entry: pick the subscription (never auto-allocated), amount defaults to the full balance. */
export function RecordPaymentDialog({ open, student, subscriptionId, onClose, onDone }: Props) {
  const toast = useToast();
  const today = businessToday();
  const [picked, setPicked] = useState(student ?? null);
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 250);
  const [matches, setMatches] = useState<StudentListItem[]>([]);
  const [subs, setSubs] = useState<SubscriptionSummary[] | null>(null);
  const [subId, setSubId] = useState(subscriptionId ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(student ?? null);
    setSubId(subscriptionId ?? '');
    setSearch('');
    setMethod(PaymentMethod.CASH);
    setDate(today);
    setReference('');
    setNote('');
    setError(null);
    // One key per dialog opening: a double click or retry can't record twice.
    setKey(crypto.randomUUID());
  }, [open, student, subscriptionId, today]);

  useEffect(() => {
    if (student || query.length < 2) return setMatches([]);
    const controller = new AbortController();
    api<StudentListItem[]>(`/students?search=${encodeURIComponent(query)}&pageSize=6&sortBy=name&sortOrder=asc`, { signal: controller.signal })
      .then(setMatches)
      .catch((e: unknown) => !isAbortError(e) && setMatches([]));
    return () => controller.abort();
  }, [query, student]);

  useEffect(() => {
    if (!open || !picked) return setSubs(null);
    setSubs(null);
    api<SubscriptionSummary[]>(`/students/${picked.id}/subscriptions`)
      .then((all) => {
        const payable = all.filter((s) => s.status !== SubscriptionStatus.CANCELLED && s.payment.duePaise > 0);
        setSubs(payable);
        setSubId((cur) => (payable.some((s) => s.id === cur) ? cur : (payable[0]?.id ?? '')));
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [open, picked]);

  const sub = useMemo(() => subs?.find((s) => s.id === subId), [subs, subId]);
  useEffect(() => {
    if (sub) setAmount(paiseToInput(sub.payment.duePaise));
  }, [sub]);

  const amountPaise = parseRupeesToPaise(amount);
  const amountError =
    amount && amountPaise === null ? 'Enter an amount like 1500 or 1500.50'
      : amountPaise === 0 ? 'Amount must be more than ₹0'
      : sub && amountPaise && amountPaise > sub.payment.duePaise ? `At most ${formatPaise(sub.payment.duePaise)} is due`
      : undefined;

  const submit = async () => {
    if (!picked || !sub || !amountPaise || amountError) return;
    setSaving(true);
    setError(null);
    try {
      const payment = await api<PaymentRecord>('/payments', {
        method: 'POST',
        body: {
          studentId: picked.id,
          subscriptionId: sub.id,
          amountPaise,
          method,
          paymentDate: date,
          ...(reference.trim() && METHODS_WITH_REFERENCE.includes(method) ? { referenceNumber: reference.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          idempotencyKey: key,
        },
      });
      toast.success(`${formatPaise(payment.amountPaise)} recorded`, `Receipt ${payment.receiptNumber}`);
      onDone(payment);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={picked?.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!sub || !amountPaise || !!amountError}>
            Record {amountPaise && !amountError ? formatPaise(amountPaise) : 'payment'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!student && (
          picked ? (
            <div className="flex items-center justify-between rounded-control bg-canvas p-3">
              <span className="font-semibold">{picked.name}</span>
              <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setSubs(null); }}>Change</Button>
            </div>
          ) : (
            <div>
              <SearchInput label="Student" value={search} onChange={setSearch} placeholder="Search student name or mobile" />
              {matches.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-control border border-border">
                  {matches.map((s) => (
                    <li key={s.id}>
                      <button className="flex min-h-11 w-full items-center justify-between px-3 text-left hover:bg-canvas" onClick={() => setPicked({ id: s.id, name: fullName(s) })}>
                        <span className="font-medium">{fullName(s)}</span>
                        <span className="text-sm text-ink-muted">{formatMobile(s.mobile)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}

        {picked && !subs && !error && <div className="flex justify-center py-3"><Spinner className="text-brand-600" /></div>}
        {subs && subs.length === 0 && (
          <Alert tone="info">
            Nothing is due for this student. <Link href={`/students/${picked!.id}`} className="font-semibold underline">Open student</Link>
          </Alert>
        )}

        {subs && subs.length > 0 && (
          <>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Pay for</legend>
              <div className="flex flex-col gap-2">
                {subs.map((s) => (
                  <label key={s.id} className={cn('flex cursor-pointer items-start gap-3 rounded-control border p-3', s.id === subId ? 'border-brand-500 bg-brand-50' : 'border-border')}>
                    <input type="radio" name="sub" className="mt-1 size-5 accent-brand-600" checked={s.id === subId} onChange={() => setSubId(s.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{s.plan.name} <PaymentStatusBadge status={s.payment.status} /></span>
                      <span className="block text-sm text-ink-muted">{formatDate(s.startDate)} – {formatDate(s.endDate)} · {s.status.toLowerCase()}</span>
                      <span className="block text-sm">Fee {formatPaise(s.payment.payablePaise)} · Paid {formatPaise(s.payment.paidPaise)} · <strong>Due {formatPaise(s.payment.duePaise)}</strong></span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="amount" label="Amount" prefix="₹" inputMode="decimal" required value={amount} error={amountError} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
              <Input id="paymentDate" type="date" label="Payment date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Method</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.values(PaymentMethod).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className={cn('min-h-11 rounded-control border-2 text-sm font-semibold', method === m ? 'border-brand-600 bg-brand-600 text-white' : 'border-border hover:border-brand-200')}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </fieldset>

            {METHODS_WITH_REFERENCE.includes(method) && (
              <Input id="reference" label="UTR / reference (optional)" maxLength={PAYMENT_LIMITS.referenceMax} value={reference} onChange={(e) => setReference(e.target.value)} />
            )}
            <Input id="note" label="Note (optional)" maxLength={PAYMENT_LIMITS.noteMax} value={note} onChange={(e) => setNote(e.target.value)} />

            {sub && amountPaise && !amountError && (
              <p className="rounded-control bg-canvas p-3 text-sm">
                After this payment: paid <strong>{formatPaise(sub.payment.paidPaise + amountPaise)}</strong> · due{' '}
                <strong>{formatPaise(sub.payment.duePaise - amountPaise)}</strong>
              </p>
            )}
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
