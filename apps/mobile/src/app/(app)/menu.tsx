import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MEAL_LABELS, StudentMenuRange, type MealKey, type StudentMenuDay } from '@mess/shared';
import { DayMenu, visibleMeals } from '@/components/day-menu';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { menuDayLabel, useStudentMenu } from '@/lib/use-student-menu';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

const TABS: { key: StudentMenuRange; label: string }[] = [
  { key: StudentMenuRange.TODAY, label: 'Today' },
  { key: StudentMenuRange.TOMORROW, label: 'Tomorrow' },
  { key: StudentMenuRange.WEEK, label: 'Week' },
];

function summary(day: StudentMenuDay, key: MealKey) {
  const meal = day.menu![key];
  if (!meal.available) return 'Unavailable';
  return meal.items.length ? meal.items.join(', ') : '—';
}

/** Collapsed: one line per meal. Tap to see the full day. */
function WeekDay({ day, served }: { day: StudentMenuDay; served: Record<MealKey, boolean> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable onPress={() => day.menu && setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Card>
          <View style={styles.dayHeader}>
            <AppText variant="label" style={{ flex: 1 }}>
              {menuDayLabel(day.date)}
            </AppText>
            {day.menu && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkMuted} />}
          </View>
          {!day.menu ? (
            <AppText muted>Not published</AppText>
          ) : (
            !open &&
            visibleMeals(day.menu, served).map((key) => (
              <AppText key={key} numberOfLines={1}>
                <AppText muted>{MEAL_LABELS[key]}: </AppText>
                {summary(day, key)}
              </AppText>
            ))
          )}
        </Card>
      </Pressable>
      {open && <DayMenu menu={day.menu} served={served} dayLabel="This day's" />}
    </View>
  );
}

export default function MenuScreen() {
  const { session } = useAuth();
  const [tab, setTab] = useState<StudentMenuRange>(StudentMenuRange.TODAY);
  const { data, loading, error, reload } = useStudentMenu(tab);

  return (
    <Screen edges={[]} onRefresh={reload} refreshing={loading && !!data}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <AppText style={[styles.tabLabel, tab === t.key && { color: '#fff' }]}>{t.label}</AppText>
          </Pressable>
        ))}
      </View>

      {error ? (
        <ErrorState title="Couldn't load the menu" description={error} onRetry={reload} />
      ) : !data ? (
        <FullScreenLoader />
      ) : !data.linked ? (
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      ) : tab === StudentMenuRange.WEEK ? (
        <View style={{ gap: spacing.md }}>
          {data.days.map((day) => (
            <WeekDay key={day.date} day={day} served={data.servedMeals} />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <AppText muted>{menuDayLabel(data.days[0].date)}</AppText>
          <DayMenu
            menu={data.days[0].menu}
            served={data.servedMeals}
            dayLabel={tab === StudentMenuRange.TODAY ? "Today's" : "Tomorrow's"}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4 },
  tab: { flex: 1, minHeight: TOUCH_TARGET - 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.brand600 },
  tabLabel: { fontWeight: '600' },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
});
