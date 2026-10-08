import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaymentReceipt } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { colors, spacing } from '@/theme/tokens';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText muted>{label}</AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

/** Read-only receipt for one of the student's own payments. */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReceipt(await api<PaymentReceipt>(`/students/me/payments/${id}`));
    } catch (e) {
      setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 });
    }
  }, [id]);
  useEffect(() => {
    setReceipt(null);
    void load();
  }, [load]);

  if (error) return error.notFound ? <EmptyState icon="receipt-outline" title="Receipt not found" /> : <ErrorState description={error.message} onRetry={load} />;
  if (!receipt) return <FullScreenLoader />;
  const reversed = receipt.status === PaymentTransactionStatus.REVERSED;

  return (
    <Screen edges={[]}>
      <Card style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="title">{receipt.mess.name}</AppText>
        <AppText variant="caption" muted>
          Payment receipt · {receipt.receiptNumber}
        </AppText>
        <AppText variant="display" style={[{ marginTop: spacing.sm }, reversed && { textDecorationLine: 'line-through', color: colors.inkMuted }]}>
          {formatPaise(receipt.amountPaise)}
        </AppText>
        {reversed && (
          <AppText style={{ color: colors.danger, fontWeight: '600' }}>This payment was cancelled by the mess</AppText>
        )}
      </Card>
      <Card>
        <Row label="Plan" value={receipt.subscription.planName} />
        <Row label="Plan dates" value={`${formatDate(receipt.subscription.startDate)} – ${formatDate(receipt.subscription.endDate)}`} />
        <Row label="Paid on" value={formatDate(receipt.paymentDate)} />
        <Row label="Method" value={PAYMENT_METHOD_LABELS[receipt.method]} />
        {receipt.referenceNumber && <Row label="Reference" value={receipt.referenceNumber} />}
        <Row label="Due after this payment" value={formatPaise(receipt.balanceAfterPaise)} />
        <Row label="Due now" value={formatPaise(receipt.currentDuePaise)} />
        {receipt.recordedBy && <Row label="Received by" value={receipt.recordedBy} />}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  value: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
