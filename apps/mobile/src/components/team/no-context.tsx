import { Ionicons } from '@expo/vector-icons';
import { resolveSession, ROLE_LABELS } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

/** Signed in, but nothing to operate here: platform admin (web portal) or a team account without a mess. */
export default function NoContextScreen() {
  const { session, logout } = useAuth();
  if (!session) return null;
  const ctx = resolveSession(session);
  const message =
    ctx.mode === 'ADMIN'
      ? 'Platform administration is available on the web portal.'
      : 'Your account is not linked to a mess yet, or your access was removed. Ask your mess owner to add you.';
  return (
    <Screen>
      <Ionicons name="business-outline" size={36} color={colors.brand600} />
      <AppText variant="display">Hi, {session.user.firstName}!</AppText>
      <AppText muted>Signed in as {ROLE_LABELS[session.role]}</AppText>
      <Card><AppText>{message}</AppText></Card>
      <Button title="Sign out" variant="secondary" onPress={() => void logout()} />
    </Screen>
  );
}
