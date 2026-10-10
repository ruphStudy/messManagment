import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { colors, spacing } from '@/theme/tokens';

const CHOICES: { title: string; description: string; note?: string; icon: ComponentProps<typeof Ionicons>['name']; href: Href }[] = [
  {
    title: 'I own a mess',
    description: 'Create and manage my own mess.',
    note: 'Mess Owner plans may require a paid subscription after the trial period.',
    icon: 'business-outline',
    href: '/register-owner',
  },
  // Student signup is the verified-mobile (OTP) flow: the account is created on first sign-in.
  { title: 'I am a student / member', description: 'Join and use a mess where I am registered.', icon: 'school-outline', href: '/' },
];

/** Only two self-signup choices (shared SignupIntent): managers/staff are added by their mess. */
export default function SignupChoiceScreen() {
  return (
    <Screen>
      <AppText variant="display" style={styles.title}>How will you use MessMate?</AppText>
      {CHOICES.map((c) => (
        <Pressable key={c.title} onPress={() => router.push(c.href)} accessibilityRole="button" accessibilityLabel={c.title}>
          <Card style={styles.row}>
            <Ionicons name={c.icon} size={30} color={colors.brand600} />
            <View style={styles.flex}>
              <AppText style={{ fontWeight: '700' }}>{c.title}</AppText>
              <AppText muted>{c.description}</AppText>
              {c.note && <AppText variant="caption" muted>{c.note}</AppText>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
          </Card>
        </Pressable>
      ))}
      <AppText variant="caption" muted style={styles.note}>
        Manager or staff member? Your mess owner creates your account. Use Sign in after they add you.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  note: { textAlign: 'center', marginTop: spacing.md },
});
