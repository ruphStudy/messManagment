import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { businessToday, paiseToInput, parseRupeesToPaise, PAYMENT_METHOD_LABELS, PaymentMethod, type Expense, type ExpenseCategory } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { FullScreenLoader } from '@/components/states';
import { Chips, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { confirm, isDate, mutate, useApi } from '@/lib/team';

/** Add / edit / reverse an expense (same validation as web: integer paise, valid date, active category). */
export default function ExpenseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toast = useToast();
  const categories = useApi<ExpenseCategory[]>('/expense-categories');
  const [loaded, setLoaded] = useState(!id);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(businessToday());
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [vendor, setVendor] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Expense>(`/expenses/${id}`).then((e) => {
      setCategoryId(e.category.id); setTitle(e.title); setAmount(paiseToInput(e.amountPaise)); setDate(e.expenseDate);
      setMethod(e.paymentMethod); setVendor(e.vendorName ?? ''); setReference(e.referenceNumber ?? ''); setLoaded(true);
    }).catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  }, [id, toast]);
  if (!loaded || !categories.data) return <FullScreenLoader />;

  const save = async () => {
    const paise = parseRupeesToPaise(amount);
    const next = { categoryId: categoryId ? undefined : 'Choose a category', title: title.trim() ? undefined : 'Required', amountPaise: paise ? undefined : 'Enter an amount in rupees', expenseDate: isDate(date) ? undefined : 'Use YYYY-MM-DD' };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await api(id ? `/expenses/${id}` : '/expenses', { method: id ? 'PATCH' : 'POST', body: { categoryId, title: title.trim(), amountPaise: paise, expenseDate: date, paymentMethod: method, vendorName: vendor.trim() || null, referenceNumber: reference.trim() || null } });
      toast.show(id ? 'Expense updated' : 'Expense added', 'success');
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <Card>
        <SectionTitle>Category</SectionTitle>
        <Chips options={categories.data.map((c) => ({ value: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
        <TextField label="What for *" value={title} onChangeText={setTitle} error={errors.title ?? errors.categoryId} />
        <TextField label="Amount (₹) *" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} error={errors.amountPaise} />
        <TextField label="Date (YYYY-MM-DD) *" value={date} onChangeText={setDate} error={errors.expenseDate} />
        <Chips options={Object.values(PaymentMethod).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} value={method} onChange={(m) => setMethod(method === m ? null : m)} />
        <TextField label="Paid to (optional)" value={vendor} onChangeText={setVendor} />
        <TextField label="Bill / reference (optional)" value={reference} onChangeText={setReference} />
        <Button title={id ? 'Save changes' : 'Add expense'} onPress={save} loading={busy} />
      </Card>
      {id && (
        <Card>
          <TextField label="Reason for reversing (optional)" value={reason} onChangeText={setReason} />
          <Button
            title="Reverse expense"
            variant="danger"
            onPress={() => confirm('Reverse this expense?', 'It stays in history but no longer counts in totals.', 'Reverse', () =>
              void mutate(() => api(`/expenses/${id}/reverse`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} }), toast, 'Expense reversed').then((r) => r !== null && router.back()), true)}
          />
        </Card>
      )}
    </Screen>
  );
}
