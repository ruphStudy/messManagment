import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { formatPaise, PAYMENT_METHOD_LABELS, Permission, PaymentTransactionStatus, type PaymentReceipt } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Row } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { confirm, mutate, useApi, useCan } from '@/lib/team';
import { colors } from '@/theme/tokens';

export default function TeamReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const can = useCan();
  const toast = useToast();
  const { data: r, error, reload } = useApi<PaymentReceipt>(`/payments/${id}/receipt`);
  const [reason, setReason] = useState('');
  if (error) return <ErrorState title="Couldn't load the receipt" description={error} onRetry={reload} />;
  if (!r) return <FullScreenLoader />;
  const reversed = r.status === PaymentTransactionStatus.REVERSED;
  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <Card style={{ alignItems: 'center' }}>
        <AppText variant="label">{r.mess.name}</AppText>
        <AppText variant="caption" muted>Receipt {r.receiptNumber}</AppText>
        <AppText variant="display" style={reversed && { textDecorationLine: 'line-through', color: colors.inkMuted }}>{formatPaise(r.amountPaise)}</AppText>
        {reversed && <AppText style={{ color: colors.danger, fontWeight: '600' }}>Reversed{r.reversalReason ? ` — ${r.reversalReason}` : ''}</AppText>}
      </Card>
      <Card>
        <Row label="Student" value={[r.student.firstName, r.student.lastName].filter(Boolean).join(' ')} />
        <Row label="Plan" value={r.subscription.planName} />
        <Row label="Paid on" value={formatDate(r.paymentDate)} />
        <Row label="Method" value={PAYMENT_METHOD_LABELS[r.method]} />
        {r.referenceNumber && <Row label="Reference" value={r.referenceNumber} />}
        <Row label="Due after payment" value={formatPaise(r.balanceAfterPaise)} />
        <Row label="Due now" value={formatPaise(r.currentDuePaise)} />
        {r.recordedBy && <Row label="Received by" value={r.recordedBy} />}
      </Card>
      {!reversed && can(Permission.PAYMENT_REVERSE) && (
        <Card>
          <TextField label="Reason for reversing (optional)" value={reason} onChangeText={setReason} />
          <Button
            title="Reverse payment"
            variant="danger"
            onPress={() => confirm('Reverse this payment?', 'It stays in history but no longer counts, and the student owes this amount again.', 'Reverse', () =>
              void mutate(() => api(`/payments/${r.id}/reverse`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} }), toast, 'Payment reversed').then(() => reload()), true)}
          />
        </Card>
      )}
    </Screen>
  );
}
