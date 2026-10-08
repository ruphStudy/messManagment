import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { MEAL_KEYS, MEAL_LABELS, MEAL_QR_REFRESH_BEFORE_SECONDS, type MealQrResponse } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

/** Keeps the screen on while the QR is visible so it doesn't dim at the counter. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function QrScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<MealQrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [focused, setFocused] = useState(false);
  const expiresAt = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<MealQrResponse>('/students/me/meal-qr');
      setData(res);
      // Measured from receipt (not the server timestamp) so a wrong phone clock can't cause refresh loops.
      if (res.state === 'READY') expiresAt.current = Date.now() + res.expiresIn * 1000;
    } catch (e) {
      // Never keep showing an old code when a new one can't be issued.
      setData(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only issue/refresh codes while this tab is visible.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && focused && void load());
    return () => sub.remove();
  }, [focused, load]);

  // Countdown; fetch a fresh code shortly before expiry.
  useEffect(() => {
    if (!focused || data?.state !== 'READY') return;
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= MEAL_QR_REFRESH_BEFORE_SECONDS && !loading) void load();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [focused, data, loading, load]);

  if (!data && !error) return <FullScreenLoader />;
  if (error) return <ErrorState title="Couldn't load your meal QR" description={error} onRetry={load} />;
  if (!data) return null;

  if (data.state === 'NOT_LINKED') {
    return (
      <Screen edges={[]}>
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      </Screen>
    );
  }
  if (data.state === 'INACTIVE') {
    return <EmptyState icon="person-remove-outline" title="Your membership is inactive" description={`Please contact ${data.messName} to activate it.`} />;
  }
  if (data.state === 'NO_PLAN') {
    return <EmptyState icon="restaurant-outline" title="No active meal plan" description={`${data.messName} has not assigned you a meal plan for today.`} />;
  }

  const size = Math.min(width - spacing.xl * 2 - spacing.lg * 2, 300);
  const expired = secondsLeft === 0;

  return (
    <Screen edges={[]} onRefresh={load} refreshing={false}>
      {focused && <KeepAwake />}
      <Card style={styles.qrCard}>
        <AppText variant="title">{data.studentName}</AppText>
        <AppText muted>{data.messName} · {data.planName}</AppText>
        <View style={[styles.qrBox, expired && { opacity: 0.15 }]} accessibilityLabel="Your meal QR code">
          <QRCode value={data.token} size={size} ecl="M" quietZone={12} backgroundColor="#fff" color={colors.ink} />
        </View>
        <AppText variant="label" style={{ color: expired ? colors.danger : colors.inkMuted }}>
          {expired || loading ? 'Refreshing…' : `Refreshes in ${secondsLeft}s`}
        </AppText>
        <AppText variant="caption" muted style={styles.center}>
          Show this to mess staff. Turn up brightness if it doesn&apos;t scan.
        </AppText>
      </Card>

      <Card>
        <AppText variant="label">Today</AppText>
        <View style={styles.meals}>
          {MEAL_KEYS.filter((k) => data.meals[k]).map((k) => {
            const served = data.servedToday.includes(k);
            const paused = data.pausedToday.includes(k);
            const label = served ? 'Served' : paused ? 'Paused' : 'Available';
            const color = served ? colors.success : paused ? colors.brand700 : colors.inkMuted;
            return (
              <View key={k} style={styles.meal} accessibilityLabel={`${MEAL_LABELS[k]} ${label}`}>
                <Ionicons name={served ? 'checkmark-circle' : paused ? 'pause-circle' : 'ellipse-outline'} size={20} color={color} />
                <AppText style={{ color, fontWeight: served || paused ? '600' : '400' }}>
                  {MEAL_LABELS[k]} · {label}
                </AppText>
              </View>
            );
          })}
        </View>
      </Card>

      <Button title="Refresh code" variant="secondary" onPress={load} loading={loading} />
      <Pressable onPress={() => router.push('/attendance')} style={styles.link} accessibilityRole="button">
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>Meal history</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.brand700} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: 'center', gap: spacing.sm },
  qrBox: { padding: spacing.sm, backgroundColor: '#fff', borderRadius: radius.card, marginVertical: spacing.sm },
  center: { textAlign: 'center' },
  meals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  meal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET },
});
