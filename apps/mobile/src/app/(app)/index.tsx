import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STUDENT_STATUS_LABELS, StudentStatus } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { formatDate, useStudentProfile } from '@/lib/student-profile';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { session } = useAuth();
  const { data, loading, error, reload } = useStudentProfile();

  if (!data && loading) return <FullScreenLoader />;
  if (!data) return <ErrorState title="Couldn't load your details" description={error ?? undefined} onRetry={reload} />;

  const profile = data.linked ? data.profile : null;

  return (
    <Screen edges={[]} onRefresh={reload} refreshing={loading}>
      <View style={styles.greeting}>
        <AppText variant="display">{profile ? `Hi, ${profile.firstName}!` : 'Welcome!'}</AppText>
        {profile && <AppText muted>{profile.mess.name}</AppText>}
      </View>

      {profile ? (
        <>
          <Card>
            <View style={styles.row}>
              <Ionicons name="storefront-outline" size={24} color={colors.brand600} />
              <AppText variant="title" style={styles.flex}>
                {profile.mess.name}
              </AppText>
            </View>
            <AppText muted>
              Member since {formatDate(profile.joiningDate)} · {STUDENT_STATUS_LABELS[profile.status]}
            </AppText>
            {profile.status === StudentStatus.INACTIVE && (
              <AppText variant="caption" style={{ color: colors.danger }}>
                Your membership is inactive. Please contact your mess.
              </AppText>
            )}
          </Card>
          <Card>
            <AppText variant="label">Coming soon</AppText>
            <AppText muted>Your meal plan, menu and QR will appear here.</AppText>
          </Card>
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
});
