import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Permission } from '@mess/shared';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { useCan } from '@/lib/team';
import { colors, spacing } from '@/theme/tokens';

/**
 * Suspended mess or inactive MessMate subscription: read-only (the API blocks changes); shown on the dashboard and
 * every team screen that changes data.
 */
export function SuspendedBanner() {
  const { session } = useAuth();
  const can = useCan();
  if (session?.membership?.mess.status !== 'SUSPENDED') {
    if (!session?.billing || session.billing.accessAllowed) return null;
    return (
      <Card style={{ backgroundColor: colors.dangerBanner, borderColor: colors.dangerSoft, gap: spacing.lg, padding: spacing.lg + 2 }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          {/* Icon with a soft halo, aligned to the heading's first line. */}
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="alert" size={20} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1, gap: 6, paddingTop: 2 }}>
            <AppText style={{ color: colors.danger, fontWeight: '800', fontSize: 17, lineHeight: 22 }}>
              MessMate subscription {session.billing.status === 'PENDING_PAYMENT' ? 'not activated yet' : 'not active'}
            </AppText>
            <AppText muted>You can view records, but changes are blocked until the subscription is activated or a trial is granted.</AppText>
          </View>
        </View>
        {can(Permission.MESS_SETTINGS_UPDATE) ? (
          <Button title="View Billing  ›" onPress={() => router.push('/team/billing')} style={{ minHeight: 50, borderRadius: 14 }} />
        ) : (
          <AppText style={{ color: colors.danger }}>Please ask the mess owner to contact support.</AppText>
        )}
      </Card>
    );
  }
  return (
    <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
      <AppText style={{ color: colors.danger, fontWeight: '700' }}>Mess temporarily unavailable</AppText>
      <AppText style={{ color: colors.danger }}>You can view records, but changes, scanning and payments are paused. Please contact support.</AppText>
    </Card>
  );
}
