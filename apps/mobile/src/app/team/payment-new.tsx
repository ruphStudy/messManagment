import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { businessToday, formatPaise, parseRupeesToPaise, PAYMENT_METHOD_LABELS, PaymentMethod, type PaymentRecord, type StudentDetail, type StudentListItem, type SubscriptionSummary } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { Chips, SectionTitle } from '@/components/team/kit';
import { StudentPicker } from '@/components/team/student-picker';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { isDate } from '@/lib/team';

/** Not secret: only stops a double tap / retry from recording the payment twice. */
const newKey = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

/** Record a full or partial cash/UPI/... payment against one subscription (no online gateway). */
export default function PaymentNewScreen() {
  const params = useLocalSearchParams<{ studentId?: string; subscriptionId?: string }>();
  const toast = useToast();
  const [student, setStudent] = useState<StudentListItem | null>(null);
  const [subs, setSubs] = useState<SubscriptionSummary[] | null>(null);
  const [subId, setSubId] = useState<string | null>(params.subscriptionId ?? null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(businessToday());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  useEffect(() => {
    if (params.studentId) api<StudentDetail>(`/students/${params.studentId}`).then((s) => setStudent({ ...s, appLinked: s.appAccount.linked })).catch(() => undefined);
  }, [params.studentId]);
  useEffect(() => {
    setSubs(null);
    if (!student) return;
    api<SubscriptionSummary[]>(`/students/${student.id}/subscriptions`).then((all) => {
      const owing = all.filter((s) => s.payment.duePaise > 0 && s.status !== 'CANCELLED');
      setSubs(owing);
      setSubId((cur) => (cur && owing.some((s) => s.id === cur) ? cur : owing[0]?.id ?? null));
    }).catch(() => setSubs([]));
  }, [student]);
  const sub = subs?.find((s) => s.id === subId);

  const submit = async () => {
    const paise = parseRupeesToPaise(amount);
    if (!student || !sub) return;
    if (!paise) return setError('Enter an amount in rupees');
    if (paise > sub.payment.duePaise) return setError(`More than the ${formatPaise(sub.payment.duePaise)} due`);
    setBusy(true);
    setError(undefined);
    try {
      const p = await api<PaymentRecord>('/payments', { method: 'POST', body: { studentId: student.id, subscriptionId: sub.id, amountPaise: paise, method, paymentDate: date, ...(reference.trim() ? { referenceNumber: reference.trim() } : {}), idempotencyKey: key.current } });
      toast.show(`Payment recorded · ${p.receiptNumber}`, 'success');
      router.replace({ pathname: '/team/receipt', params: { id: p.id } });
    } catch (e) {
      setError(e instanceof ApiError && e.isNetwork ? 'No connection — the payment was NOT recorded. Try again.' : errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <SectionTitle>Student</SectionTitle>
      <StudentPicker value={student} onChange={(s) => { setStudent(s); setSubId(null); }} />
      {student && subs && !subs.length && <AppText muted>No unpaid meal plans for this student.</AppText>}
      {subs && subs.length > 0 && (
        <Card>
          <SectionTitle>Meal plan</SectionTitle>
          <Chips options={subs.map((s) => ({ value: s.id, label: `${s.plan.name} (${formatDate(s.startDate)}) · ${formatPaise(s.payment.duePaise)} due` }))} value={subId} onChange={setSubId} />
          <TextField label="Amount (₹)" keyboardType="decimal-pad" value={amount} onChangeText={(t) => { setAmount(t); setError(undefined); }} error={error} hint={sub ? `Due: ${formatPaise(sub.payment.duePaise)} — partial payments are fine` : undefined} />
          <Chips options={Object.values(PaymentMethod).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />
          <TextField label="Reference (UPI / cheque no., optional)" value={reference} onChangeText={setReference} />
          <TextField label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
          <Button title="Record payment" onPress={submit} loading={busy} disabled={!sub || !isDate(date)} />
        </Card>
      )}
    </Screen>
  );
}
