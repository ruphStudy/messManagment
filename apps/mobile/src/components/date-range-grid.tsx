import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, PAUSE_MAX_DAYS } from '@mess/shared';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './text';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });

interface Props {
  today: string;
  from: string | null;
  to: string | null;
  onChange: (from: string, to: string) => void;
}

/**
 * The next 31 days as a week grid. Tap a day for one day; tap a second day to make a range.
 * No date-picker dependency, and ranges are limited to PAUSE_MAX_DAYS by construction.
 */
export function DateRangeGrid({ today, from, to, onChange }: Props) {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const days = Array.from({ length: PAUSE_MAX_DAYS }, (_, i) => addDays(today, i));
  const cells: (string | null)[] = [...Array(weekday).fill(null), ...days];

  const tap = (date: string) => {
    if (!from || from !== to || date < from) onChange(date, date);
    else onChange(from, date);
  };

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <AppText key={i} variant="caption" muted style={styles.head}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
          const selected = !!from && !!to && date >= from && date <= to;
          const edge = date === from || date === to;
          const day = Number(date.slice(8));
          return (
            <Pressable
              key={date}
              onPress={() => tap(date)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={date}
              style={[styles.cell, selected && styles.inRange, edge && styles.edge]}
            >
              <AppText style={[styles.day, edge && { color: '#fff' }, date === today && !edge && { color: colors.brand700 }]}>{day}</AppText>
              {(day === 1 || date === today) && (
                <AppText variant="caption" style={[styles.month, edge && { color: '#fff' }]}>
                  {date === today ? 'Today' : monthFormat.format(new Date(`${date}T00:00:00Z`))}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  head: { width: `${100 / 7}%`, textAlign: 'center', marginBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  inRange: { backgroundColor: colors.brand100 },
  edge: { backgroundColor: colors.brand600 },
  day: { fontWeight: '600' },
  month: { fontSize: 9, lineHeight: 11, color: colors.inkMuted },
});
