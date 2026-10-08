import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK_LIMITS, FEEDBACK_WINDOW_DAYS, MEAL_LABELS, RATING_DIMENSIONS, RATING_LABELS, type EligibleMeal, type RatingDimension } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { StarInput } from '@/components/star-input';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

type Values = Record<RatingDimension, number | null>;
const EMPTY: Values = { overall: null, taste: null, quality: null, quantity: null, cleanliness: null };

/** Pick a recently served meal, tap the overall stars, optionally add details and a comment. */
export default function RateMealScreen() {
  const toast = useToast();
  const [meals, setMeals] = useState<EligibleMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EligibleMeal | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api<EligibleMeal[]>('/students/me/feedback/eligible-meals');
      setMeals(list);
      setSelected((cur) => list.find((m) => m.attendanceId === cur?.attendanceId) ?? list[0] ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!selected || !values.overall) return;
    setSaving(true);
    try {
      await api('/students/me/feedback/meal', {
        method: 'POST',
        body: {
          attendanceId: selected.attendanceId,
          overallRating: values.overall,
          ...Object.fromEntries(RATING_DIMENSIONS.filter((d) => d !== 'overall' && values[d] !== null).map((d) => [`${d}Rating`, values[d]])),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        },
      });
      toast.show('Thanks for your feedback!', 'success');
      setValues(EMPTY);
      setComment('');
      await load();
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState title="Couldn't load your meals" description={error} onRetry={load} />;
  if (!meals) return <FullScreenLoader />;
  if (!meals.length) {
    return <EmptyState icon="star-outline" title="No recent meals to rate." description={`Meals you are served can be rated within ${FEEDBACK_WINDOW_DAYS} days.`} />;
  }

  return (
    <Screen edges={[]}>
      <AppText variant="label" muted>CHOOSE A MEAL</AppText>
      <View style={styles.chips}>
        {meals.map((m) => {
          const on = m.attendanceId === selected?.attendanceId;
          return (
            <Pressable key={m.attendanceId} onPress={() => { setSelected(m); setValues(EMPTY); setComment(''); }} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <AppText style={[{ fontWeight: '600' }, on && { color: '#fff' }]}>{MEAL_LABELS[m.mealType]}</AppText>
              <AppText variant="caption" style={on ? { color: '#fff' } : { color: colors.inkMuted }}>{menuDayLabel(m.date)}</AppText>
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <Card style={{ gap: spacing.md }}>
          <StarInput label={`How was ${MEAL_LABELS[selected.mealType].toLowerCase()}?`} value={values.overall} onChange={(v) => setValues((cur) => ({ ...cur, overall: v }))} large />
          {values.overall !== null && (
            <>
              <AppText variant="caption" muted>Optional details</AppText>
              {RATING_DIMENSIONS.filter((d) => d !== 'overall').map((d) => (
                <StarInput key={d} label={RATING_LABELS[d]} value={values[d]} onChange={(v) => setValues((cur) => ({ ...cur, [d]: v }))} />
              ))}
              <TextInput
                value={comment}
                onChangeText={setComment}
                maxLength={FEEDBACK_LIMITS.commentMax}
                multiline
                placeholder="Anything to add? (optional)"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                accessibilityLabel="Comment"
              />
            </>
          )}
          <Button title="Submit rating" onPress={submit} loading={saving} disabled={!values.overall} />
        </Card>
      )}

      <Pressable onPress={() => router.push('/give-feedback')} style={styles.link} accessibilityRole="button">
        <Ionicons name="chatbox-outline" size={18} color={colors.brand700} />
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>General feedback instead</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: radius.control, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, minHeight: TOUCH_TARGET },
  chipOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, minHeight: 90, padding: spacing.md, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET },
});
