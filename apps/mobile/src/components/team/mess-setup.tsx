import { useState } from 'react';
import { View } from 'react-native';
import {
  ErrorCode,
  FOOD_TYPE_LABELS,
  FoodType,
  MEAL_KEYS,
  MEAL_LABELS,
  MESS_TYPE_LABELS,
  MessType,
  normalizeMobile,
  toMessInputFromForm,
  validateMessForm,
  type MealKey,
  type MessFormInput,
  type MessProfile,
} from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';
import { Chips, SectionTitle } from './kit';
import { StateCityPicker } from './state-city-picker';

/**
 * First-time setup for an owner without a mess (same POST /mess and shared validation as web onboarding).
 * Creates the owner's OWN new mess only; the server takes the owner from the session — no mess id is ever sent.
 * Shown again on refresh/reopen until a mess exists.
 */
export default function MessSetupScreen() {
  const { session, refreshSession, logout } = useAuth();
  const toast = useToast();
  const [v, setV] = useState<MessFormInput>({
    name: '',
    mobile: session?.user.mobile ?? '',
    email: session?.user.email ?? '',
    messType: MessType.STUDENT_MESS,
    foodType: FoodType.VEG,
    address: '',
    city: '',
    state: '',
    pincode: '',
    breakfastAvailable: false,
    lunchAvailable: true,
    dinnerAvailable: true,
    openingTime: '',
    closingTime: '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MessFormInput>(k: K, value: MessFormInput[K]) => {
    setV((x) => ({ ...x, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const values = { ...v, mobile: normalizeMobile(v.mobile) ?? v.mobile };
    const next = validateMessForm(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return toast.show('Please fix the highlighted fields', 'error');
    setBusy(true);
    try {
      await api<MessProfile>('/mess', { method: 'POST', body: toMessInputFromForm(values) });
      // New membership → the session resolves to TEAM and the owner app opens.
      await refreshSession();
      toast.show('Your mess is ready', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.code === ErrorCode.MESS_ALREADY_EXISTS) {
        await refreshSession().catch(() => undefined);
        return;
      }
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="display">Set up your mess</AppText>
      <AppText muted>A few details and you&apos;re ready to add students and serve meals.</AppText>

      <Card>
        <SectionTitle>Basic details</SectionTitle>
        <TextField label="Mess name *" value={v.name} error={errors.name} onChangeText={(t) => set('name', t)} />
        <TextField label="Contact number *" keyboardType="phone-pad" maxLength={13} value={v.mobile} error={errors.mobile} onChangeText={(t) => set('mobile', t)} />
        <TextField label="Email (optional)" keyboardType="email-address" autoCapitalize="none" value={v.email} error={errors.email} onChangeText={(t) => set('email', t)} />
        <AppText variant="label">Mess type</AppText>
        <Chips options={Object.values(MessType).map((t) => ({ value: t, label: MESS_TYPE_LABELS[t] }))} value={v.messType} onChange={(t) => set('messType', t)} />
      </Card>

      <Card>
        <SectionTitle>Address</SectionTitle>
        <TextField label="Address *" multiline value={v.address} error={errors.address} onChangeText={(t) => set('address', t)} />
        <StateCityPicker
          state={v.state}
          city={v.city}
          errors={{ state: errors.state, city: errors.city }}
          onChange={(x) => { setV((p) => ({ ...p, ...x })); setErrors((e) => ({ ...e, state: undefined, city: undefined })); }}
        />
        <TextField label="Pincode *" keyboardType="number-pad" maxLength={6} value={v.pincode} error={errors.pincode} onChangeText={(t) => set('pincode', t.replace(/\D/g, ''))} />
      </Card>

      <Card>
        <SectionTitle>Meals & food</SectionTitle>
        <AppText variant="label">Meals you serve *</AppText>
        <Chips
          options={MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))}
          value={MEAL_KEYS.filter((k) => v[`${k}Available`])}
          onChange={(k: MealKey) => set(`${k}Available`, !v[`${k}Available`])}
        />
        {errors.meals && <AppText style={{ color: colors.danger }}>{errors.meals}</AppText>}
        <AppText variant="label">Food served</AppText>
        <Chips options={Object.values(FoodType).map((f) => ({ value: f, label: FOOD_TYPE_LABELS[f] }))} value={v.foodType} onChange={(f) => set('foodType', f)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><TextField label="Opens (HH:mm, optional)" maxLength={5} value={v.openingTime} error={errors.openingTime} onChangeText={(t) => set('openingTime', t)} /></View>
          <View style={{ flex: 1 }}><TextField label="Closes (HH:mm, optional)" maxLength={5} value={v.closingTime} error={errors.closingTime} onChangeText={(t) => set('closingTime', t)} /></View>
        </View>
        <AppText variant="caption" muted>Serving times and pause cut-offs start with sensible defaults; change them later in Settings.</AppText>
      </Card>

      <Button title="Create my mess" onPress={submit} loading={busy} />
      <Button title="Sign out" variant="ghost" onPress={() => void logout()} />
    </Screen>
  );
}
