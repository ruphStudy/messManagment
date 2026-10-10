import { useEffect, useState } from 'react';
import { ATTENDANCE_NOTE_MAX, MEAL_LABELS, Permission, StudentStatus, type MealType, type ServeResult, type StudentListItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, SearchBar } from '@/components/team/kit';
import { ServeResultCard } from '@/components/team/serve-result';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { useDebounced } from '@/components/team/use-debounced';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { api, ApiError, errorMessage } from '@/lib/api';
import { defaultMeal, useServedMeals } from '@/lib/meal-default';
import { useCan } from '@/lib/team';
import { colors } from '@/theme/tokens';

function Manual({ meals, initial }: { meals: MealType[]; initial: MealType }) {
  const [meal, setMeal] = useState<MealType>(initial);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [results, setResults] = useState<StudentListItem[] | null>(null);
  const [picked, setPicked] = useState<StudentListItem | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ServeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.length < 2) return setResults(null);
    api<StudentListItem[]>(`/students?search=${encodeURIComponent(q)}&status=${StudentStatus.ACTIVE}&pageSize=8&sortBy=name&sortOrder=asc`).then(setResults).catch(() => setResults([]));
  }, [q]);

  const mark = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api<ServeResult>('/attendance/manual', { method: 'POST', body: { studentId: picked.id, mealType: meal, ...(note.trim() ? { note: note.trim() } : {}) } }));
      setPicked(null);
      setSearch('');
      setNote('');
    } catch (e) {
      setError(e instanceof ApiError && e.isNetwork ? 'No connection — this meal was NOT recorded. Try again.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <Chips options={meals.map((m) => ({ value: m, label: MEAL_LABELS[m] }))} value={meal} onChange={setMeal} />
      {result && <ServeResultCard result={result} />}
      {error && <Card style={{ backgroundColor: colors.dangerSoft, borderColor: 'transparent' }}><AppText style={{ color: colors.danger }}>{error}</AppText></Card>}
      {picked ? (
        <Card>
          <AppText variant="title">{[picked.firstName, picked.lastName].filter(Boolean).join(' ')}</AppText>
          <AppText muted>{picked.mobile}</AppText>
          <TextField label="Note (optional)" value={note} maxLength={ATTENDANCE_NOTE_MAX} onChangeText={setNote} />
          <Button title={`Mark ${MEAL_LABELS[meal]} served`} onPress={mark} loading={busy} />
          <Button title="Choose someone else" variant="ghost" onPress={() => setPicked(null)} />
        </Card>
      ) : (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Search active student (name or mobile)" />
          {results?.map((s) => <ListItem key={s.id} avatar={[s.firstName, s.lastName].filter(Boolean).join(' ')} title={[s.firstName, s.lastName].filter(Boolean).join(' ')} subtitle={s.mobile} onPress={() => { setPicked(s); setResult(null); }} />)}
          {results && !results.length && <AppText muted>No active students match.</AppText>}
        </>
      )}
    </Screen>
  );
}

/** Fallback when a student has no phone or the QR won't scan. Same rules as scanning. */
export default function ManualScreen() {
  const can = useCan();
  const served = useServedMeals();
  if (!can(Permission.ATTENDANCE_MARK)) return <EmptyState title="Not available for your role" />;
  if (!served) return <FullScreenLoader />;
  return <Manual meals={served.meals} initial={defaultMeal(served.meals, served.times)} />;
}
