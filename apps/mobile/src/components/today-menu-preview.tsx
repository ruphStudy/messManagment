import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MEAL_KEYS, MEAL_LABELS, type MealKey, type StudentMenuResponse } from '@mess/shared';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { visibleMeals } from './day-menu';
import { Card } from './layout';
import { AppText } from './text';

/** Breakfast until 10, lunch until 3 pm, then dinner (device clock; students are in the mess's timezone). */
function upcomingMeals(): MealKey[] {
  const hour = new Date().getHours();
  const start = hour < 10 ? 0 : hour < 15 ? 1 : 2;
  return MEAL_KEYS.slice(start);
}

/** Short "Today's menu" card for Home: the next meals only, with a link to the full menu. */
export function TodayMenuPreview({ data }: { data: StudentMenuResponse | null }) {
  if (!data?.linked) return null;
  const day = data.days[0];
  const meals = day?.menu ? visibleMeals(day.menu, data.servedMeals).filter((k) => upcomingMeals().includes(k)).slice(0, 2) : [];

  return (
    <Card>
      <View style={styles.row}>
        <Ionicons name="restaurant-outline" size={22} color={colors.brand600} />
        <AppText variant="title" style={styles.flex}>
          Today&apos;s menu
        </AppText>
      </View>
      {!day?.menu ? (
        <AppText muted>Today&apos;s menu has not been published yet.</AppText>
      ) : meals.length === 0 ? (
        <AppText muted>No more meals today.</AppText>
      ) : (
        meals.map((key) => {
          const meal = day.menu![key];
          return (
            <AppText key={key} numberOfLines={2}>
              <AppText style={{ fontWeight: '600' }}>{MEAL_LABELS[key]}: </AppText>
              {!meal.available ? `${MEAL_LABELS[key]} unavailable` : meal.items.join(', ') || 'Items not listed'}
            </AppText>
          );
        })
      )}
      <Pressable onPress={() => router.push('/menu')} style={styles.link} accessibilityRole="button">
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>View full menu</AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.brand700} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: TOUCH_TARGET - 8 },
});
