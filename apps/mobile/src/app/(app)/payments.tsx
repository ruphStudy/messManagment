import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaginationMeta, type PaymentRecord } from '@mess/shared';
import { Button } from '@/components/button';
import { FeeCard } from '@/components/fee-card';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { apiEnvelope, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/student-profile';
import { useFees } from '@/lib/use-fees';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

const PAGE_SIZE = 20;

function PaymentItem({ p }: { p: PaymentRecord }) {
  const reversed = p.status === PaymentTransactionStatus.REVERSED;
  return (
    <Pressable onPress={() => router.push({ pathname: '/receipt', params: { id: p.id } })} accessibilityRole="button" accessibilityLabel={`Receipt ${p.receiptNumber}`}>
      <Card style={styles.row}>
        <Ionicons name={reversed ? 'arrow-undo-outline' : 'receipt-outline'} size={22} color={reversed ? colors.placeholder : colors.brand600} />
        <View style={styles.flex}>
          <AppText variant="label" style={reversed && { textDecorationLine: 'line-through', color: colors.inkMuted }}>
            {formatPaise(p.amountPaise)} · {PAYMENT_METHOD_LABELS[p.method]}
          </AppText>
          <AppText variant="caption" muted>
            {formatDate(p.paymentDate)} · {p.receiptNumber}
            {reversed ? ' · Cancelled by mess' : ''}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </Card>
    </Pressable>
  );
}

export default function PaymentsScreen() {
  const { session } = useAuth();
  const fees = useFees();
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadHistory = useCallback(async (page: number) => {
    setLoadingMore(true);
    setHistoryError(null);
    try {
      const res = await apiEnvelope<PaymentRecord[]>(`/students/me/payments?page=${page}&pageSize=${PAGE_SIZE}`);
      setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setMeta(res.meta ?? null);
    } catch (e) {
      setHistoryError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, []);
  useEffect(() => {
    void loadHistory(1);
  }, [loadHistory]);

  const refresh = () => {
    void fees.reload();
    void loadHistory(1);
  };

  if (!fees.data && fees.error) return <ErrorState title="Couldn't load your fees" description={fees.error} onRetry={fees.reload} />;
  if (!fees.data) return <FullScreenLoader />;
  if (!fees.data.linked) {
    return (
      <Screen edges={[]}>
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      </Screen>
    );
  }

  const { totalDuePaise, subscriptions } = fees.data;
  return (
    <Screen edges={[]} onRefresh={refresh} refreshing={false}>
      <Card style={{ backgroundColor: totalDuePaise ? colors.dangerSoft : colors.successSoft, borderColor: 'transparent' }}>
        <AppText variant="caption" muted>
          {totalDuePaise ? 'Amount due' : 'All fees'}
        </AppText>
        <AppText variant="display" style={{ color: totalDuePaise ? colors.danger : colors.success }}>
          {totalDuePaise ? formatPaise(totalDuePaise) : 'Paid in full'}
        </AppText>
        {totalDuePaise > 0 && (
          <AppText variant="caption" muted>
            Pay at {fees.data.messName}. Payments made at the mess appear here.
          </AppText>
        )}
      </Card>

      {subscriptions.length === 0 ? (
        <Card>
          <AppText muted>Your mess has not assigned a meal plan yet.</AppText>
        </Card>
      ) : (
        subscriptions.map((s) => <FeeCard key={s.id} sub={s} />)
      )}

      <AppText variant="label" muted>
        PAYMENT HISTORY
      </AppText>
      {historyError ? (
        <ErrorState title="Couldn't load payments" description={historyError} onRetry={() => loadHistory(1)} />
      ) : !meta ? (
        <FullScreenLoader />
      ) : items.length === 0 ? (
        <Card>
          <AppText muted>No payments recorded yet.</AppText>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((p) => (
            <PaymentItem key={p.id} p={p} />
          ))}
          {meta.page < meta.totalPages && <Button title="Load more" variant="secondary" loading={loadingMore} onPress={() => loadHistory(meta.page + 1)} />}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  flex: { flex: 1 },
});
