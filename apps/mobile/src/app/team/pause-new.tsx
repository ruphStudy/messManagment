import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { addDays, businessToday, MEAL_KEYS, MEAL_LABELS, PAUSE_REASON_MAX, PAUSE_REASON_PRESETS, type CreatePauseResult, type MealType, type StudentDetail, type StudentListItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { Chips, SectionTitle } from '@/components/team/kit';
import { StudentPicker } from '@/components/team/student-picker';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { isDate, mutate } from '@/lib/team';

/** Team adds a pause on a student's behalf (e.g. they phoned in). Same rules as student self-pause. */
export default function PauseNewScreen() {
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const toast = useToast();
  const [student, setStudent] = useState<StudentListItem | null>(null);
  const [from, setFrom] = useState(addDays(businessToday(), 1));
  const [to, setTo] = useState(addDays(businessToday(), 1));
  const [meals, setMeals] = useState<MealType[]>([]);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<CreatePauseResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (studentId) api<StudentDetail>(`/students/${studentId}`).then((s) => setStudent({ ...s, appLinked: s.appAccount.linked })).catch(() => undefined);
  }, [studentId]);

  const submit = async () => {
    if (!student) return;
    setBusy(true);
    const res = await mutate(() => api<CreatePauseResult>(`/students/${student.id}/pauses`, { method: 'POST', body: { fromDate: from, toDate: to, mealTypes: meals, ...(reason.trim() ? { reason: reason.trim() } : {}) } }), toast);
    setBusy(false);
    if (res) {
      setResult(res);
      if (res.created.length) toast.show(`${res.created.length} meal${res.created.length === 1 ? '' : 's'} paused`, 'success');
    }
  };
  const problems = result ? [...result.skipped, ...result.failed] : [];

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <SectionTitle>Student</SectionTitle>
      <StudentPicker value={student} onChange={setStudent} />
      <Card>
        <TextField label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} />
        <TextField label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} />
        <Chips options={MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))} value={meals} onChange={(m) => setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />
        <Chips options={PAUSE_REASON_PRESETS.map((r) => ({ value: r, label: r }))} value={reason} onChange={(r) => setReason(reason === r ? '' : r)} />
        <TextField label="Reason (optional)" value={reason} maxLength={PAUSE_REASON_MAX} onChangeText={setReason} />
      </Card>
      {result && (
        <Card>
          <AppText variant="label">{result.created.length ? `${result.created.length} paused` : 'Nothing was paused'}</AppText>
          {problems.map((p) => <AppText key={`${p.date}-${p.mealType}`} variant="caption" muted>{menuDayLabel(p.date)} · {p.message}</AppText>)}
        </Card>
      )}
      <Button title="Pause meals" onPress={submit} loading={busy} disabled={!student || !meals.length || !isDate(from) || !isDate(to)} />
      {result?.created.length ? <Button title="Done" variant="secondary" onPress={() => router.back()} /> : null}
    </Screen>
  );
}
