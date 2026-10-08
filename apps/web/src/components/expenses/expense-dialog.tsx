'use client';

import { useEffect, useState } from 'react';
import {
  businessToday,
  EXPENSE_LIMITS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  paiseToInput,
  parseRupeesToPaise,
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
} from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  /** Present = edit, absent = add. */
  expense?: Expense | null;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}

type Values = { categoryId: string; title: string; amount: string; expenseDate: string; paymentMethod: PaymentMethod | ''; vendorName: string; referenceNumber: string; note: string };

const fromExpense = (e?: Expense | null): Values => ({
  categoryId: e?.category.id ?? '',
  title: e?.title ?? '',
  amount: e ? paiseToInput(e.amountPaise) : '',
  expenseDate: e?.expenseDate ?? businessToday(),
  paymentMethod: e?.paymentMethod ?? '',
  vendorName: e?.vendorName ?? '',
  referenceNumber: e?.referenceNumber ?? '',
  note: e?.note ?? '',
});

/** One fast form for adding and editing an expense. Amounts are parsed as text into paise. */
export function ExpenseDialog({ open, expense, onClose, onSaved }: Props) {
  const toast = useToast();
  const today = businessToday();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [values, setValues] = useState<Values>(fromExpense(expense));
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(fromExpense(expense));
    setErrors({});
    setFormError(null);
    api<ExpenseCategory[]>('/expense-categories').then(setCategories).catch(() => setCategories([]));
  }, [open, expense]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Keep an inactive category selectable only for the expense that already uses it.
  const options = categories.some((c) => c.id === values.categoryId) || !expense
    ? categories
    : [...categories, { id: expense.category.id, name: `${expense.category.name} (turned off)`, isActive: false, expenseCount: 0 }];

  const save = async () => {
    const amountPaise = parseRupeesToPaise(values.amount);
    const next: typeof errors = {
      categoryId: values.categoryId ? undefined : 'Choose a category',
      title: values.title.trim() ? undefined : 'What was it for?',
      amount: amountPaise ? (amountPaise > EXPENSE_LIMITS.amountMaxPaise ? 'Amount is too large for one entry' : undefined) : 'Enter an amount like 2500 or 2500.50',
      expenseDate: !values.expenseDate ? 'Choose a date' : values.expenseDate > today ? 'Expenses cannot be in the future' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const body: ExpenseInput = {
      categoryId: values.categoryId,
      title: values.title.trim(),
      amountPaise: amountPaise!,
      expenseDate: values.expenseDate,
      paymentMethod: values.paymentMethod || null,
      vendorName: values.vendorName.trim() || null,
      referenceNumber: values.referenceNumber.trim() || null,
      note: values.note.trim() || null,
    };
    setSaving(true);
    setFormError(null);
    try {
      const saved = expense
        ? await api<Expense>(`/expenses/${expense.id}`, { method: 'PATCH', body })
        : await api<Expense>('/expenses', { method: 'POST', body });
      toast.success(expense ? 'Expense updated' : 'Expense added', saved.title);
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k === 'amountPaise' ? 'amount' : k, v[0]])));
      }
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{expense ? 'Save changes' : 'Add expense'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 8).map((c) => (
            <button key={c.id} type="button" onClick={() => set('categoryId', c.id)} aria-pressed={values.categoryId === c.id} className={cn('min-h-9 rounded-full border px-3 text-sm', values.categoryId === c.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-border hover:bg-canvas')}>
              {c.name}
            </button>
          ))}
        </div>
        <Select id="categoryId" label="Category" placeholder="Choose category" required options={options.map((c) => ({ value: c.id, label: c.name }))} value={values.categoryId} error={errors.categoryId} onChange={(e) => set('categoryId', e.target.value)} />
        <Input id="title" label="What for" placeholder="e.g. Weekly vegetables" required maxLength={EXPENSE_LIMITS.titleMax} value={values.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="amount" label="Amount" prefix="₹" inputMode="decimal" required value={values.amount} error={errors.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))} />
          <Input id="expenseDate" type="date" label="Date" max={today} required value={values.expenseDate} error={errors.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} />
        </div>
        <details className="rounded-control border border-border p-3" open={!!(values.vendorName || values.paymentMethod || values.referenceNumber || values.note)}>
          <summary className="cursor-pointer text-sm font-medium">More details (optional)</summary>
          <div className="mt-3 flex flex-col gap-3">
            <Input id="vendorName" label="Paid to (shop / person)" maxLength={EXPENSE_LIMITS.vendorMax} value={values.vendorName} onChange={(e) => set('vendorName', e.target.value)} />
            <Select id="paymentMethod" label="Paid by" options={[{ value: '', label: 'Not specified' }, ...Object.values(PaymentMethod).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))]} value={values.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod | '')} />
            <Input id="referenceNumber" label="Bill / UTR number" maxLength={EXPENSE_LIMITS.referenceMax} value={values.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
            <Input id="note" label="Note" maxLength={EXPENSE_LIMITS.noteMax} value={values.note} onChange={(e) => set('note', e.target.value)} />
          </div>
        </details>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
