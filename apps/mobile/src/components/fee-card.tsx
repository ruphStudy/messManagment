import { StyleSheet, View } from 'react-native';
import { formatPaise, PAYMENT_STATUS_LABELS, type SubscriptionPaymentStatus, type SubscriptionSummary } from '@mess/shared';
import { formatDate } from '@/lib/student-profile';
import { colors, radius, spacing } from '@/theme/tokens';
import { Card } from './layout';
import { StatusPill } from './subscription-card';
import { AppText } from './text';

const PAY_COLORS: Record<SubscriptionPaymentStatus, { bg: string; fg: string }> = {
  PAID: { bg: colors.successSoft, fg: colors.success },
  PARTIAL: { bg: colors.brand100, fg: colors.brand700 },
  UNPAID: { bg: colors.dangerSoft, fg: colors.danger },
};

export function PaymentPill({ status }: { status: SubscriptionPaymentStatus }) {
  const c = PAY_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <AppText variant="caption" style={{ color: c.fg, fontWeight: '600' }}>
        {PAYMENT_STATUS_LABELS[status]}
      </AppText>
    </View>
  );
}

/** Total fee / Paid / Due for one subscription — plain words, no accounting terms. */
export function FeeCard({ sub }: { sub: SubscriptionSummary }) {
  const { payablePaise, paidPaise, duePaise, status } = sub.payment;
  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="label" style={styles.flex}>
          {sub.plan.name}
        </AppText>
        <StatusPill status={sub.status} />
        <PaymentPill status={status} />
      </View>
      <AppText variant="caption" muted>
        {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
      </AppText>
      <View style={styles.amounts}>
        {[
          ['Total fee', formatPaise(payablePaise), colors.ink],
          ['Paid', formatPaise(paidPaise), colors.success],
          ['Due', formatPaise(duePaise), duePaise ? colors.danger : colors.ink],
        ].map(([label, value, color]) => (
          <View key={label} style={styles.flex}>
            <AppText variant="caption" muted>
              {label}
            </AppText>
            <AppText variant="title" style={{ color }}>
              {value}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  amounts: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2 },
});
