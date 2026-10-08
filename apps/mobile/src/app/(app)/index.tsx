import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { STUDENT_STATUS_LABELS, StudentStatus } from '@mess/shared';
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
import { usePauseSettings } from '@/lib/use-pause-settings';
import { useStudentMenu } from '@/lib/use-student-menu';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

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
          <AppText muted>Your mess has not assigned a meal plan yet.</AppText>
        </Card>
      )}
      <Pressable onPress={() => router.push('/plans')} style={styles.link} accessibilityRole="button">
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>View plan history</AppText>
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
  const { data, loading, error } = profileState;

  if (!data && loading) return <FullScreenLoader />;
  if (!data) return <ErrorState title="Couldn't load your details" description={error ?? undefined} onRetry={profileState.reload} />;

  const profile = data.linked ? data.profile : null;
  const refresh = () => {
    void profileState.reload();
    void subscription.reload();
    void todayMenu.reload();
    void pauseSettings.reload();
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
          {profile.status === StudentStatus.INACTIVE && (
            <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
              <AppText style={{ color: colors.danger }}>
                Your membership is {STUDENT_STATUS_LABELS[profile.status].toLowerCase()}. Please contact your mess.
              </AppText>
            </Card>
          )}
          {pauseSettings.data?.linked && <TodayMealsStrip meals={pauseSettings.data.todayMeals} />}
          <TodayMenuPreview data={todayMenu.data} />
          <PlanSection data={subscription.data} error={subscription.error} reload={subscription.reload} />
        </>
      ) : (
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET },
});
