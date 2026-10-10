import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { MEAL_LABELS, Permission, type MealType, type ServeResult } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, FullScreenLoader } from '@/components/states';
import { Chips } from '@/components/team/kit';
import { ServeResultCard } from '@/components/team/serve-result';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { api, ApiError, errorMessage } from '@/lib/api';
import { defaultMeal, useServedMeals } from '@/lib/meal-default';
import { useCan } from '@/lib/team';
import { colors, radius } from '@/theme/tokens';

/** The camera sees a code many times per second: ignore the same code for a few seconds. */
const SAME_CODE_COOLDOWN_MS = 4000;

function Scanner({ meals, initial }: { meals: MealType[]; initial: MealType }) {
  // Camera only while this screen is visible.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [permission, requestPermission] = useCameraPermissions();
  const [meal, setMeal] = useState<MealType>(initial);
  const [result, setResult] = useState<ServeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const mealRef = useRef(meal);
  mealRef.current = meal;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const onScan = async (code: string) => {
    if (busy) return;
    if (last.current && last.current.code === code && Date.now() - last.current.at < SAME_CODE_COOLDOWN_MS) return;
    last.current = { code, at: Date.now() };
    setBusy(true);
    setError(null);
    try {
      // Same endpoint and rules as the web scanner; nothing is recorded unless the API says SERVED.
      setResult(await api<ServeResult>('/attendance/scan', { method: 'POST', body: { qrToken: code, mealType: mealRef.current } }));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError && e.isNetwork ? 'No connection — this meal was NOT recorded. Try again.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <FullScreenLoader />;
  if (!permission.granted) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="camera-outline" title="Camera access needed" description="Allow the camera to scan student meal QR codes, or use manual attendance." />
        {permission.canAskAgain ? <Button title="Allow camera" onPress={() => void requestPermission()} /> : <Button title="Open Settings" onPress={() => void Linking.openSettings()} />}
      </Screen>
    );
  }
  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <Chips options={meals.map((m) => ({ value: m, label: MEAL_LABELS[m] }))} value={meal} onChange={setMeal} />
      <View style={styles.camera}>
        {focused && <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : ({ data }) => void onScan(data)} />}
      </View>
      <AppText muted style={{ textAlign: 'center' }}>{busy ? 'Checking…' : `Scanning for ${MEAL_LABELS[meal]} — point at the student's QR`}</AppText>
      {result && <ServeResultCard result={result} />}
      {error && <Card style={{ backgroundColor: colors.dangerSoft, borderColor: 'transparent' }}><AppText style={{ color: colors.danger }}>{error}</AppText></Card>}
    </Screen>
  );
}

export default function ScanScreen() {
  const can = useCan();
  const served = useServedMeals();
  if (!can(Permission.ATTENDANCE_MARK)) return <EmptyState title="Not available for your role" />;
  if (!served) return <FullScreenLoader />;
  return <Scanner meals={served.meals} initial={defaultMeal(served.meals, served.times)} />;
}

const styles = StyleSheet.create({
  camera: { height: 320, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#000' },
});
