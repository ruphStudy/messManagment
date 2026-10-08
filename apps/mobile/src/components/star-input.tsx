import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RATING_MAX } from '@mess/shared';
import { colors, TOUCH_TARGET } from '@/theme/tokens';
import { AppText } from './text';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  large?: boolean;
}

/** Tap 1–5 stars. Each star is a full-size touch target. */
export function StarInput({ label, value, onChange, large }: Props) {
  const size = large ? 40 : 30;
  return (
    <View style={styles.wrap} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 1, max: RATING_MAX, now: value ?? 0 }}>
      <AppText variant="label" style={styles.label}>{label}</AppText>
      <View style={styles.row}>
        {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} style={styles.star} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
            <Ionicons name={value !== null && n <= value ? 'star' : 'star-outline'} size={size} color={value !== null && n <= value ? '#f59e0b' : colors.placeholder} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  label: { marginBottom: 2 },
  row: { flexDirection: 'row' },
  star: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
