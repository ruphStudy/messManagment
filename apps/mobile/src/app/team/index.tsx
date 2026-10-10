import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPaise, MEAL_KEYS, MEAL_LABELS, Permission, type DashboardOverview, type ExpectedMeals } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Pill, SectionTitle, Stats } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { useApi, useCan } from '@/lib/team';
import { colors, radius, spacing, themed } from '@/theme/tokens';

const MENU_STATUS = { PUBLISHED: { label: 'Published', tone: 'success' }, DRAFT: { label: 'Draft', tone: 'brand' }, NOT_CREATED: { label: 'Not created', tone: 'danger' } } as const;

function Meals({ title, counts, today }: { title: string; counts: ExpectedMeals; today: boolean }) {
  return (
    <Card>
      <AppText variant="label">{title}</AppText>
      {MEAL_KEYS.map((k) => {
        const m = counts.meals[k];
        return (
          <View key={k} style={styles.mealRow}>
            <AppText style={{ flex: 1, fontWeight: '600' }}>{MEAL_LABELS[k]}</AppText>
            <AppText variant="caption" muted>{today ? `${m.served} served · ${m.remaining} left · ` : ''}{m.paused} paused</AppText>
            <AppText variant="title" style={{ minWidth: 40, textAlign: 'right' }}>{m.expected}</AppText>
          </View>
        );
      })}
      <AppText variant="caption" muted>Expected = students on a plan minus pauses</AppText>
    </Card>
  );
}

/** Same /dashboard as the web: the API leaves out sections the role may not see (staff get no money/business data). */
export default function TeamHome() {
  const { session, refreshSession } = useAuth();
  const can = useCan();
  const { data, error, loading, reload } = useApi<DashboardOverview>('/dashboard');
  if (error && !data) return <ErrorState title="Couldn't load the dashboard" description={error} onRetry={reload} />;
  if (!data) return <FullScreenLoader />;

  const actions: { label: string; icon: ComponentProps<typeof Ionicons>['name']; href: Href; show: boolean }[] = [
    { label: 'Scan QR', icon: 'qr-code-outline', href: '/team/scan', show: can(Permission.ATTENDANCE_MARK) },
    { label: 'Manual', icon: 'hand-left-outline', href: '/team/manual', show: can(Permission.ATTENDANCE_MARK) },
    { label: 'Add student', icon: 'person-add-outline', href: '/team/student-form', show: can(Permission.STUDENT_MANAGE) },
    { label: 'Payment', icon: 'cash-outline', href: '/team/payment-new', show: can(Permission.PAYMENT_RECORD) },
    { label: 'Expense', icon: 'receipt-outline', href: '/team/expense-form', show: can(Permission.EXPENSE_MANAGE) },
    { label: 'Menu', icon: 'restaurant-outline', href: '/team/menu', show: can(Permission.MENU_VIEW) },
    { label: 'Dues', icon: 'wallet-outline', href: '/team/dues', show: can(Permission.FINANCE_VIEW) },
    { label: 'Complaints', icon: 'chatbubble-ellipses-outline', href: '/team/complaints', show: can(Permission.COMPLAINT_VIEW) },
  ];
  const { money, students, subscriptions, complaints, feedback } = data;

  return (
    <Screen edges={[]} onRefresh={() => { void reload(); void refreshSession().catch(() => undefined); }} refreshing={loading}>
      <View style={{ gap: 2 }}>
        <AppText variant="display">Hi, {session?.user.firstName}!</AppText>
        <AppText muted>{session?.membership?.mess.name}</AppText>
      </View>
      <SuspendedBanner />
      <View style={styles.actions}>
        {actions.filter((a) => a.show).map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href)} style={styles.action} accessibilityRole="button" accessibilityLabel={a.label}>
            <Ionicons name={a.icon} size={22} color={colors.brand700} />
            <AppText variant="caption" style={{ fontWeight: '600', textAlign: 'center' }}>{a.label}</AppText>
          </Pressable>
        ))}
      </View>
      <Card style={styles.inline}>
        <AppText variant="label" style={{ flex: 1 }}>Today&apos;s menu</AppText>
        <Pill label={MENU_STATUS[data.menu.status].label} tone={MENU_STATUS[data.menu.status].tone} />
      </Card>
      <Meals title="Today" counts={data.meals.today} today />
      <Meals title="Tomorrow" counts={data.meals.tomorrow} today={false} />
      {students && (
        <Card><SectionTitle>Students</SectionTitle><Stats items={[{ label: 'Active', value: students.active }, { label: 'Joined this month', value: students.joinedThisMonth }]} /></Card>
      )}
      {money && (
        <Card>
          <SectionTitle>Money</SectionTitle>
          <Stats
            items={[
              { label: 'Collected today', value: formatPaise(money.collectedTodayPaise) },
              { label: 'This month', value: formatPaise(money.collectedThisMonthPaise) },
              { label: 'Pending dues', value: formatPaise(money.pendingDuesPaise), tone: money.pendingDuesPaise ? 'danger' : undefined },
              { label: 'Expenses (month)', value: formatPaise(money.expensesThisMonthPaise) },
              { label: 'Estimated balance', value: formatPaise(money.balance.netPaise), tone: money.balance.netPaise < 0 ? 'danger' : 'success' },
            ]}
          />
          <AppText variant="caption" muted>Estimate = collected − expenses (not accounting profit).</AppText>
        </Card>
      )}
      {(subscriptions || complaints || feedback) && (
        <Card>
          <SectionTitle>Attention</SectionTitle>
          <Stats
            items={[
              ...(subscriptions ? [{ label: 'Plans ending in 7 days', value: subscriptions.expiringSoon, tone: subscriptions.expiringSoon ? ('danger' as const) : undefined }] : []),
              ...(complaints ? [{ label: 'Open complaints', value: complaints.OPEN, tone: complaints.OPEN ? ('danger' as const) : undefined }] : []),
              ...(feedback ? [{ label: 'Rating (month)', value: feedback.monthAverage == null ? '—' : `${feedback.monthAverage.toFixed(1)}★` }] : []),
            ]}
          />
        </Card>
      )}
      {data.actionItems.map((a) => (
        <Card key={a.key} style={styles.inline}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.brand700} />
          <AppText style={{ flex: 1 }}>{a.label}</AppText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { width: '23%', minWidth: 72, flexGrow: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
