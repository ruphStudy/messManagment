import { router } from 'expo-router';
import { Permission } from '@mess/shared';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { useCan } from '@/lib/team';
import { colors } from '@/theme/tokens';

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
      <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
        <AppText style={{ color: colors.danger, fontWeight: '700' }}>
          MessMate subscription {session.billing.status === 'PENDING_PAYMENT' ? 'not activated yet' : 'not active'}
        </AppText>
        <AppText style={{ color: colors.danger }}>You can view records, but changes are blocked until the subscription is activated or a trial is granted.</AppText>
        {can(Permission.MESS_SETTINGS_UPDATE) ? (
          <Button title="View Billing" variant="secondary" onPress={() => router.push('/team/billing')} />
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
