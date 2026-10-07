import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { daysBetween, SUBSCRIPTION_STATUS_LABELS, SubscriptionStatus, type SubscriptionSummary } from '@mess/shared';
import { formatDate } from '@/lib/student-profile';
import { colors, radius, spacing } from '@/theme/tokens';
import { Card } from './layout';
import { AppText } from './text';

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: colors.successSoft, fg: colors.success },
  UPCOMING: { bg: colors.infoSoft, fg: colors.info },
  EXPIRED: { bg: colors.canvas, fg: colors.inkMuted },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <AppText variant="caption" style={{ color: c.fg, fontWeight: '600' }}>
        {SUBSCRIPTION_STATUS_LABELS[status]}
      </AppText>
    </View>
  );
}

function Meal({ label, included }: { label: string; included: boolean }) {
  return (
    <View style={styles.meal} accessibilityLabel={`${label} ${included ? 'included' : 'not included'}`}>
      <Ionicons name={included ? 'checkmark-circle' : 'close-circle-outline'} size={20} color={included ? colors.success : colors.placeholder} />
      <AppText style={!included && { color: colors.placeholder }}>{label}</AppText>
    </View>
  );
}

function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.progressRow}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="label">
          {value} / {total}
        </AppText>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: value }}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

/** Current or upcoming plan: validity, included meals and what's left. */
export function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  const totalDays = daysBetween(sub.startDate, sub.endDate) + 1;
  const { breakfastIncluded, lunchIncluded, dinnerIncluded } = sub.plan;
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <AppText variant="title" style={styles.flex}>
          {sub.plan.name}
        </AppText>
        <StatusPill status={sub.status} />
      </View>
      <AppText muted>
        {sub.status === SubscriptionStatus.UPCOMING ? 'Starts' : 'Valid from'} {formatDate(sub.startDate)} to {formatDate(sub.endDate)}
      </AppText>
      <View style={styles.meals}>
        {breakfastIncluded && <Meal label="Breakfast" included />}
        <Meal label="Lunch" included={lunchIncluded} />
        <Meal label="Dinner" included={dinnerIncluded} />
      </View>
      {sub.totalMealCredits !== null ? (
        <Progress label="Meals left" value={sub.remainingMealCredits ?? 0} total={sub.totalMealCredits} />
      ) : (
        <AppText variant="label">Unlimited meals during validity</AppText>
      )}
      {sub.daysRemaining !== null && <Progress label="Days left" value={sub.daysRemaining} total={totalDays} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2 },
  meals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  meal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.brand100, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.brand600, borderRadius: 4 },
});
