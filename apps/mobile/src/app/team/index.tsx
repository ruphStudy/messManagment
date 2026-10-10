import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPaise, MEAL_KEYS, MEAL_LABELS, Permission, type DashboardOverview, type ExpectedMeals, type MealKey } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Pill, SectionTitle, Stats } from '@/components/team/kit';
import { HOME_HERO_WIDTH, HomeHero } from '@/components/team/home-hero';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { useApi, useCan } from '@/lib/team';
import { colors, elevation, radius, spacing, themed } from '@/theme/tokens';

const MENU_STATUS = { PUBLISHED: { label: 'Published', tone: 'success' }, DRAFT: { label: 'Draft', tone: 'brand' }, NOT_CREATED: { label: 'Not created', tone: 'danger' } } as const;

const MEAL_ICONS: Record<MealKey, ComponentProps<typeof Ionicons>['name']> = { breakfast: 'sunny-outline', lunch: 'partly-sunny-outline', dinner: 'moon-outline' };

function Meals({ title, counts, today }: { title: string; counts: ExpectedMeals; today: boolean }) {
  return (
    <Card style={{ gap: 0 }}>
      <View style={[styles.inline, { marginBottom: spacing.sm }]}>
        <View style={styles.iconTile}><Ionicons name={today ? 'calendar-outline' : 'calendar-clear-outline'} size={20} color={colors.brand600} /></View>
        <AppText variant="title" style={{ flex: 1 }}>{title}</AppText>
      </View>
      {MEAL_KEYS.map((k, i) => {
        const m = counts.meals[k];
        return (
          <View key={k} style={[styles.mealRow, i > 0 && styles.divider]}>
            <View style={styles.mealIcon}><Ionicons name={MEAL_ICONS[k]} size={18} color={colors.brand600} /></View>
            <AppText style={{ flex: 1, fontWeight: '600' }}>{MEAL_LABELS[k]}</AppText>
            <AppText variant="caption" muted>{today ? `${m.served} served · ${m.remaining} left · ` : ''}{m.paused} paused</AppText>
            <AppText variant="title" style={{ minWidth: 36, textAlign: 'right' }}>{m.expected}</AppText>
          </View>
        );
      })}
      <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>Expected = students on a plan minus pauses</AppText>
    </Card>
  );
}

/** Same /dashboard as the web: the API leaves out sections the role may not see (staff get no money/business data). */
export default function TeamHome() {
  const { session, refreshSession } = useAuth();
  const can = useCan();
  // Decoration only on phones wide enough to keep the greeting readable beside it.
  const showHero = useWindowDimensions().width >= 360;
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
      <View style={[styles.greeting, showHero && { paddingRight: HOME_HERO_WIDTH - 16 }]}>
        {showHero && <HomeHero />}
        <AppText variant="display" style={{ fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.3 }}>Hi, {session?.user.firstName}!</AppText>
        <AppText muted style={{ fontSize: 16, lineHeight: 22 }}>{session?.membership?.mess.name}</AppText>
      </View>
      <SuspendedBanner />
      <View style={styles.actions}>
        {actions.filter((a) => a.show).map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href)} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={a.label}>
            <View style={styles.iconTile}><Ionicons name={a.icon} size={22} color={colors.brand600} /></View>
            {/* Two lines at most; long single words shrink instead of breaking ("Complaints"). */}
            <AppText numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.actionLabel}>{a.label}</AppText>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => router.push('/team/menu')} accessibilityRole="button" accessibilityLabel="Today's menu">
        <Card style={[styles.inline, { paddingVertical: spacing.lg }]}>
          <View style={styles.iconTile}><Ionicons name="restaurant-outline" size={22} color={colors.brand600} /></View>
          <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
            <AppText style={{ fontWeight: '700', fontSize: 16, lineHeight: 22 }}>Today&apos;s menu</AppText>
            {data.menu.status === 'NOT_CREATED' && <AppText variant="caption" muted numberOfLines={2}>Set up today&apos;s menu to keep students informed.</AppText>}
          </View>
          <Pill label={MENU_STATUS[data.menu.status].label} tone={MENU_STATUS[data.menu.status].tone} style={{ alignSelf: 'center' }} />
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </Card>
      </Pressable>
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
  greeting: { gap: 0, marginTop: -spacing.xs, marginBottom: -spacing.xs, minHeight: 76, justifyContent: 'center' },
  // Four equal tiles per row (fixed width, no grow): squarer cards like the mocks.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { width: '23%', flexGrow: 0, minHeight: 86, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: 2, ...elevation(1) },
  actionLabel: { fontSize: 13, lineHeight: 16, fontWeight: '700', textAlign: 'center', color: colors.ink },
  iconTile: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' },
  mealIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, minHeight: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
}));
