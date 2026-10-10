import { useState } from 'react';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import {
  cityStateError,
  FOOD_TYPE_LABELS,
  FoodType,
  MEAL_KEYS,
  MEAL_LABELS,
  MESSAGES,
  Permission,
  TIME_REGEX,
  type MealKey,
  type MessProfile,
} from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { FullScreenLoader } from '@/components/states';
import { Chips, ListItem, SectionTitle } from '@/components/team/kit';
import { StateCityPicker } from '@/components/team/state-city-picker';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { ThemeSelector } from '@/components/theme-selector';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { mutate, useApi, useCan } from '@/lib/team';
import { colors } from '@/theme/tokens';

type TimeKey = `${MealKey}Start` | `${MealKey}End` | `${MealKey}PauseCutoff`;

/** Meals served, serving windows and pause cut-offs (owner + manager) — PATCH /mess/settings. */
function MealSettings({ mess, onSaved }: { mess: MessProfile; onSaved: (m: MessProfile) => void }) {
  const toast = useToast();
  const [served, setServed] = useState<Record<MealKey, boolean>>({ breakfast: mess.breakfastAvailable, lunch: mess.lunchAvailable, dinner: mess.dinnerAvailable });
  const [times, setTimes] = useState<Record<TimeKey, string>>(() => Object.fromEntries(MEAL_KEYS.flatMap((k) => [`${k}Start`, `${k}End`, `${k}PauseCutoff`].map((t) => [t, mess[t as keyof MessProfile] as string]))) as Record<TimeKey, string>);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const bad = Object.fromEntries(Object.entries(times).map(([k, v]) => [k, TIME_REGEX.test(v) ? undefined : MESSAGES.time]));
    setErrors(bad);
    if (Object.values(bad).some(Boolean)) return;
    setBusy(true);
    try {
      onSaved(await api<MessProfile>('/mess/settings', { method: 'PATCH', body: { breakfastAvailable: served.breakfast, lunchAvailable: served.lunch, dinnerAvailable: served.dinner, ...times } }));
      toast.show('Meal settings saved', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <SectionTitle>Meals & timings</SectionTitle>
      {MEAL_KEYS.map((k) => (
        <View key={k} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText variant="label" style={{ flex: 1 }}>{MEAL_LABELS[k]}</AppText>
            <Switch value={served[k]} onValueChange={(v) => setServed((s) => ({ ...s, [k]: v }))} trackColor={{ true: colors.brand500 }} accessibilityLabel={`${MEAL_LABELS[k]} served`} />
          </View>
          {served[k] && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Start', 'End', 'PauseCutoff'] as const).map((s) => {
                const key = `${k}${s}` as TimeKey;
                return (
                  <View key={key} style={{ flex: 1 }}>
                    <TextField label={s === 'PauseCutoff' ? 'Pause before' : s} value={times[key]} error={errors[key]} maxLength={5} placeholder="HH:mm" onChangeText={(t) => setTimes((x) => ({ ...x, [key]: t }))} />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ))}
      <AppText variant="caption" muted>Serving times pick the scanner&apos;s default meal and students&apos; next meal. Same-day pauses close at the cut-off. 24h HH:mm, Indian time.</AppText>
      <Button title="Save meal settings" onPress={save} loading={busy} />
    </Card>
  );
}

/** Name, contact, address, food type — owner only (PATCH /mess). */
function MessProfileForm({ mess, onSaved }: { mess: MessProfile; onSaved: (m: MessProfile) => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: mess.name, mobile: mess.mobile, email: mess.email ?? '', address: mess.address, pincode: mess.pincode });
  const [loc, setLoc] = useState({ state: mess.state, city: mess.city });
  const [locError, setLocError] = useState<{ state?: string; city?: string }>({});
  const [foodType, setFoodType] = useState<FoodType>(mess.foodType);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    // Saved city/state: an older free-text city stays valid until city or state is changed.
    const err = { state: loc.state ? undefined : 'Select a state', city: loc.city ? cityStateError(loc.state, loc.city, { state: mess.state, city: mess.city }) : 'City is required' };
    setLocError(err);
    if (err.state || err.city) return toast.show('Please fix the highlighted fields', 'error');
    setBusy(true);
    const res = await mutate(() => api<MessProfile>('/mess', { method: 'PATCH', body: { ...v, ...loc, email: v.email.trim() || null, foodType } }), toast, 'Mess profile saved');
    if (res) onSaved(res);
    setBusy(false);
  };
  return (
    <Card>
      <SectionTitle>Mess profile</SectionTitle>
      {(Object.keys(v) as (keyof typeof v)[]).map((k) => (
        <TextField key={k} label={{ name: 'Mess name', mobile: 'Contact number', email: 'Email', address: 'Address', pincode: 'Pincode' }[k]} value={v[k]} onChangeText={(t) => setV({ ...v, [k]: t })} />
      ))}
      <StateCityPicker state={loc.state} city={loc.city} errors={locError} onChange={(x) => { setLoc(x); setLocError({}); }} />
      <Chips options={Object.values(FoodType).map((f) => ({ value: f, label: FOOD_TYPE_LABELS[f] }))} value={foodType} onChange={setFoodType} />
      <Button title="Save profile" onPress={save} loading={busy} />
    </Card>
  );
}

/** Operational settings only (personal account lives in Profile). Owner: mess profile + meals; manager: meals; everyone: appearance. */
export default function TeamSettingsScreen() {
  const can = useCan();
  const showMess = can(Permission.MESS_SETTINGS_UPDATE);
  const { data: mess, setData } = useApi<MessProfile>(showMess ? '/mess' : null);
  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      {showMess && !mess && <FullScreenLoader />}
      {showMess && mess && <MealSettings key={mess.updatedAt} mess={mess} onSaved={setData} />}
      {can(Permission.MESS_UPDATE) && mess && <MessProfileForm key={`p${mess.updatedAt}`} mess={mess} onSaved={setData} />}
      <Card>
        <SectionTitle>Appearance</SectionTitle>
        <ThemeSelector />
        <AppText variant="caption" muted>Saved on this device. System follows your phone setting.</AppText>
      </Card>
      {(can(Permission.STAFF_VIEW) || showMess) && (
        <Card>
          {can(Permission.STAFF_VIEW) && <ListItem title="Staff & access" icon="people-circle-outline" onPress={() => router.push('/team/staff')} />}
          {showMess && <ListItem title="Billing & Subscription" icon="card-outline" onPress={() => router.push('/team/billing')} />}
        </Card>
      )}
    </Screen>
  );
}
