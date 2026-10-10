import { StyleSheet, View } from 'react-native';
import { MEAL_KEYS, MEAL_LABELS, type MealType, type TodayMealState } from '@mess/shared';
import { colors, radius, spacing, themed } from '@/theme/tokens';
import { AppText } from './text';

const STATE: Record<Exclude<TodayMealState, 'NOT_INCLUDED'>, { label: string; bg: string; fg: string }> = themed(() => ({
  AVAILABLE: { label: 'Available', bg: colors.successSoft, fg: colors.success },
  PAUSED: { label: 'Paused', bg: colors.brand100, fg: colors.brand700 },
  SERVED: { label: 'Served ✓', bg: colors.infoSoft, fg: colors.info },
}));

/** "Lunch · Paused   Dinner · Available" for today's meals in the student's plan. */
export function TodayMealsStrip({ meals }: { meals: Record<MealType, TodayMealState> }) {
  const shown = MEAL_KEYS.filter((k) => meals[k] !== 'NOT_INCLUDED');
  if (!shown.length) return null;
  return (
    <View style={styles.row} accessibilityLabel="Today's meals">
      {shown.map((k) => {
        const s = STATE[meals[k] as Exclude<TodayMealState, 'NOT_INCLUDED'>];
        return (
          <View key={k} style={[styles.pill, { backgroundColor: s.bg }]}>
            <AppText variant="caption" style={{ color: s.fg, fontWeight: '600' }}>
              {MEAL_LABELS[k]} · {s.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
