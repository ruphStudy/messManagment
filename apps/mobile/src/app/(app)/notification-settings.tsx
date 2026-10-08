import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import type { NotificationPreferences } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { pushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

const TOGGLES: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: 'paymentDueEnabled', label: 'Payment reminders', hint: 'When your mess reminds you about fees' },
  { key: 'subscriptionExpiryEnabled', label: 'Plan expiry', hint: 'A few days before your plan ends' },
  { key: 'menuUpdatesEnabled', label: 'Menu changes', hint: "When today's or tomorrow's menu changes" },
  { key: 'pauseUpdatesEnabled', label: 'Pause updates', hint: 'When meals are paused or resumed' },
];

export default function NotificationSettingsScreen() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission>('unavailable');

  const load = useCallback(async () => {
    setError(null);
    try {
      setPrefs(await api<NotificationPreferences>('/notification-preferences'));
      setPermission(await pushPermission());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      setPrefs(await api<NotificationPreferences>('/notification-preferences', { method: 'PATCH', body: { [key]: value } }));
      if (key === 'pushEnabled' && value) setPermission(await registerForPush());
    } catch (e) {
      setPrefs(previous);
      toast.show(errorMessage(e), 'error');
    }
  };

  if (error) return <ErrorState title="Couldn't load settings" description={error} onRetry={load} />;
  if (!prefs) return <FullScreenLoader />;

  return (
    <Screen edges={[]}>
      <Card>
        {TOGGLES.map((t) => (
          <View key={t.key} style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="label">{t.label}</AppText>
              <AppText variant="caption" muted>{t.hint}</AppText>
            </View>
            <Switch value={prefs[t.key]} onValueChange={(v) => toggle(t.key, v)} trackColor={{ true: colors.brand500 }} accessibilityLabel={t.label} />
          </View>
        ))}
        <AppText variant="caption" muted>Reminders sent personally by your mess always appear in Notifications.</AppText>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="label">Push notifications</AppText>
            <AppText variant="caption" muted>Alerts on your phone. Turning this off keeps everything in Notifications.</AppText>
          </View>
          <Switch value={prefs.pushEnabled} onValueChange={(v) => toggle('pushEnabled', v)} trackColor={{ true: colors.brand500 }} accessibilityLabel="Push notifications" />
        </View>
        {prefs.pushEnabled && permission === 'denied' && (
          <>
            <AppText variant="caption" style={{ color: colors.danger }}>Notifications are blocked in your phone settings, so you won&apos;t get alerts.</AppText>
            <Button title="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          </>
        )}
        {prefs.pushEnabled && permission === 'unavailable' && (
          <AppText variant="caption" muted>Phone alerts aren&apos;t available on this device. You&apos;ll still see everything in Notifications.</AppText>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 8 },
  flex: { flex: 1 },
});
