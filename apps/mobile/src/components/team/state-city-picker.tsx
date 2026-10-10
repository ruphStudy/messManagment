import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { citiesForState, findCity, INDIAN_STATES } from '@mess/shared';
import { Button } from '@/components/button';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { colors } from '@/theme/tokens';

const match = (list: readonly string[], q: string, min: number) => {
  const t = q.trim().toLowerCase();
  return t.length < min ? [] : list.filter((s) => s.toLowerCase().includes(t)).slice(0, 8);
};

function Picked({ label, value, onChange, disabled }: { label: string; value: string; onChange: () => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <AppText style={{ flex: 1 }}>{label}: <AppText style={{ fontWeight: '600' }}>{value}</AppText></AppText>
      {!disabled && <Button title="Change" variant="ghost" onPress={onChange} />}
    </View>
  );
}

function Options({ items, onPick }: { items: readonly string[]; onPick: (v: string) => void }) {
  return (
    <>
      {items.map((s) => (
        <Pressable key={s} onPress={() => onPick(s)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
          <AppText style={{ color: colors.brand700, fontWeight: '600' }}>{s}</AppText>
        </Pressable>
      ))}
    </>
  );
}

/**
 * State first, then a searchable city list for that state (bundled dataset, offline). Changing the state clears the city.
 * An older saved city that is not in the list is still shown (marked "saved") until it is changed.
 */
export function StateCityPicker({ state, city, onChange, errors = {}, disabled }: { state: string; city: string; onChange: (v: { state: string; city: string }) => void; errors?: { state?: string; city?: string }; disabled?: boolean }) {
  const [stateQuery, setStateQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const cities = citiesForState(state);
  const stateMatches = useMemo(() => match(INDIAN_STATES, stateQuery, 2), [stateQuery]);
  // Few cities → show them all; otherwise filter as the user types.
  const cityMatches = useMemo(() => (cities.length <= 8 ? cities : match(cities, cityQuery, 1)), [cities, cityQuery]);

  return (
    <>
      {state ? (
        <Picked label="State" value={state} disabled={disabled} onChange={() => { onChange({ state: '', city: '' }); setStateQuery(''); setCityQuery(''); }} />
      ) : (
        <>
          <TextField label="State *" placeholder="Type to search" value={stateQuery} error={errors.state} onChangeText={setStateQuery} editable={!disabled} />
          <Options items={stateMatches} onPick={(s) => onChange({ state: s, city: '' })} />
        </>
      )}
      {!state ? (
        <AppText muted>Select a state to choose the city.</AppText>
      ) : city ? (
        <>
          <Picked label="City" value={findCity(state, city) ? city : `${city} (saved)`} disabled={disabled} onChange={() => { onChange({ state, city: '' }); setCityQuery(''); }} />
          {errors.city && <AppText style={{ color: colors.danger }}>{errors.city}</AppText>}
        </>
      ) : (
        <>
          {cities.length > 8 && <TextField label="City *" placeholder="Type to search" value={cityQuery} error={errors.city} onChangeText={setCityQuery} editable={!disabled} />}
          {cities.length <= 8 && <AppText variant="label">City *</AppText>}
          {cities.length <= 8 && errors.city && <AppText style={{ color: colors.danger }}>{errors.city}</AppText>}
          <Options items={cityMatches} onPick={(c) => onChange({ state, city: c })} />
        </>
      )}
    </>
  );
}
