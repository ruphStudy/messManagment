import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MEAL_KEYS, MEAL_LABELS, type MealKey, type PublishedMenu } from '@mess/shared';
import { colors, spacing, themed } from '@/theme/tokens';
import { Card } from './layout';
import { EmptyState } from './states';
import { AppText } from './text';

const MEAL_ICONS: Record<MealKey, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'cafe-outline',
  lunch: 'sunny-outline',
  dinner: 'moon-outline',
};

/** Meals to show: ones the mess serves, plus any that have items that day. */
export function visibleMeals(menu: PublishedMenu, served: Record<MealKey, boolean>): MealKey[] {
  return MEAL_KEYS.filter((k) => served[k] || (menu[k].available && menu[k].items.length > 0));
}

export function MealCard({ mealKey, menu }: { mealKey: MealKey; menu: PublishedMenu }) {
  const meal = menu[mealKey];
  const label = MEAL_LABELS[mealKey];
  return (
    <Card style={!meal.available && { backgroundColor: colors.canvas }}>
      <View style={styles.header}>
        <Ionicons name={MEAL_ICONS[mealKey]} size={22} color={meal.available ? colors.brand600 : colors.placeholder} />
        <AppText variant="title" style={styles.flex}>
          {label}
        </AppText>
      </View>
      {!meal.available ? (
        <AppText style={{ color: colors.inkMuted, fontWeight: '600' }}>{label} unavailable</AppText>
      ) : meal.items.length ? (
        <View style={styles.items}>
          {meal.items.map((item) => (
            <View key={item} style={styles.itemRow}>
              <View style={styles.dot} />
              <AppText style={styles.flex}>{item}</AppText>
            </View>
          ))}
        </View>
      ) : (
        <AppText muted>Items not listed</AppText>
      )}
      {meal.note && (
        <AppText variant="caption" muted>
          {meal.note}
        </AppText>
      )}
    </Card>
  );
}

interface DayMenuProps {
  menu: PublishedMenu | null;
  served: Record<MealKey, boolean>;
  /** e.g. "Today's" → "Today's menu has not been published yet." */
  dayLabel: string;
}

/** Full menu for one day; reused by Today, Tomorrow and the expanded week view. */
export function DayMenu({ menu, served, dayLabel }: DayMenuProps) {
  if (!menu) {
    return <EmptyState icon="restaurant-outline" title={`${dayLabel} menu has not been published yet.`} description="Check back later." />;
  }
  return (
    <View style={{ gap: spacing.md }}>
      {menu.generalNote && (
        <Card style={styles.note}>
          <View style={styles.header}>
            <Ionicons name="megaphone-outline" size={20} color={colors.brand700} />
            <AppText style={[styles.flex, { color: colors.brand700 }]}>{menu.generalNote}</AppText>
          </View>
        </Card>
      )}
      {visibleMeals(menu, served).map((key) => (
        <MealCard key={key} mealKey={key} menu={menu} />
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  items: { gap: spacing.xs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand500 },
  note: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
}));
