import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPaise, MEAL_LABELS, STUDENT_STATUS_LABELS, StudentStatus, type EligibleMeal } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { SubscriptionCard } from '@/components/subscription-card';
import { TodayMealsStrip } from '@/components/today-meals-strip';
import { TodayMenuPreview } from '@/components/today-menu-preview';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { formatDate, useStudentProfile } from '@/lib/student-profile';
import { useMySubscription } from '@/lib/use-my-subscription';
import { api } from '@/lib/api';
import { useFees } from '@/lib/use-fees';
import { usePauseSettings } from '@/lib/use-pause-settings';
import { useStudentMenu } from '@/lib/use-student-menu';
import { colors, spacing, TOUCH_TARGET, themed } from '@/theme/tokens';

function PlanSection({ data, error, reload }: Pick<ReturnType<typeof useMySubscription>, 'data' | 'error' | 'reload'>) {
  if (error) return <ErrorState title="Couldn't load your plan" description={error} onRetry={reload} />;
  if (!data?.linked) return null;
  const { current, upcoming } = data;
  return (
    <View style={{ gap: spacing.md }}>
      {current && <SubscriptionCard sub={current} />}
      {upcoming && (
        <>
          {current && <AppText variant="label" muted>NEXT PLAN</AppText>}
          <SubscriptionCard sub={upcoming} />
        </>
      )}
      {!current && !upcoming && (
        <Card>
          <View style={styles.row}>
            <Ionicons name="restaurant-outline" size={24} color={colors.brand600} />
            <AppText variant="title" style={styles.flex}>No meal plan yet</AppText>
          </View>
          <AppText muted>Choose one of your mess&apos;s plans, or ask your mess to assign one.</AppText>
          <Button title="Choose a plan" onPress={() => router.push('/plans')} />
        </Card>
      )}
      <Pressable onPress={() => router.push('/plans')} style={styles.link} accessibilityRole="button">
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>Plans & history</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.brand700} />
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const { session } = useAuth();
  const profileState = useStudentProfile();
  const subscription = useMySubscription();
  const todayMenu = useStudentMenu('today');
  const pauseSettings = usePauseSettings();
  const fees = useFees();
  const [toRate, setToRate] = useState<EligibleMeal | null>(null);
  const loadToRate = () => api<EligibleMeal[]>('/students/me/feedback/eligible-meals').then((m) => setToRate(m[0] ?? null)).catch(() => setToRate(null));
  useEffect(() => {
    void loadToRate();
  }, []);
  const { data, loading, error } = profileState;

  if (!data && loading) return <FullScreenLoader />;
  if (!data) return <ErrorState title="Couldn't load your details" description={error ?? undefined} onRetry={profileState.reload} />;

  const profile = data.linked ? data.profile : null;
  const refresh = () => {
    void profileState.reload();
    void subscription.reload();
    void todayMenu.reload();
    void pauseSettings.reload();
    void fees.reload();
    void loadToRate();
  };

  return (
    <Screen edges={[]} onRefresh={refresh} refreshing={loading || subscription.loading}>
      <View style={styles.greeting}>
        <AppText variant="display">{profile ? `Hi, ${profile.firstName}!` : 'Welcome!'}</AppText>
        {profile && (
          <AppText muted>
            {profile.mess.name} · member since {formatDate(profile.joiningDate)}
          </AppText>
        )}
      </View>

      {profile ? (
        <>
          {profile.mess.status === 'SUSPENDED' && (
            <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
              <AppText style={{ color: colors.danger, fontWeight: '600' }}>Mess temporarily unavailable</AppText>
              <AppText style={{ color: colors.danger }}>
                {profile.mess.name} is paused for now. You can see your history, but meal QR, pauses, feedback and complaints are unavailable.
              </AppText>
            </Card>
          )}
          {profile.status === StudentStatus.INACTIVE && (
            <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
              <AppText style={{ color: colors.danger }}>
                Your membership is {STUDENT_STATUS_LABELS[profile.status].toLowerCase()}. Please contact your mess.
              </AppText>
            </Card>
          )}
          {pauseSettings.data?.linked && <TodayMealsStrip meals={pauseSettings.data.todayMeals} />}
          <TodayMenuPreview data={todayMenu.data} />
          {toRate && (
            <Pressable onPress={() => router.push('/rate-meal')} accessibilityRole="button" style={styles.feeRow}>
              <Ionicons name="star-outline" size={20} color="#f59e0b" />
              <AppText style={{ flex: 1, fontWeight: '600' }}>Rate your recent {MEAL_LABELS[toRate.mealType].toLowerCase()}</AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
            </Pressable>
          )}
          <PlanSection data={subscription.data} error={subscription.error} reload={subscription.reload} />
          {fees.data?.linked && fees.data.subscriptions.length > 0 && (
            <Pressable onPress={() => router.push('/payments')} accessibilityRole="button" style={styles.feeRow}>
              <Ionicons name="wallet-outline" size={20} color={fees.data.totalDuePaise ? colors.danger : colors.success} />
              <AppText style={{ flex: 1, color: fees.data.totalDuePaise ? colors.danger : colors.success, fontWeight: '600' }}>
                {fees.data.totalDuePaise ? `Due: ${formatPaise(fees.data.totalDuePaise)}` : 'Fees paid in full'}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
            </Pressable>
          )}
        </>
      ) : (
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      )}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  greeting: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET },
}));
