import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from '@mess/shared';
import { useAppTheme } from '@/theme/theme-provider';
import { colors, radius, spacing, themed } from '@/theme/tokens';
import { AppText } from './text';

const ICONS: Record<ThemePreference, ComponentProps<typeof Ionicons>['name']> = { light: 'sunny-outline', dark: 'moon-outline', system: 'color-palette-outline' };
/** Mobile: "System" is the fixed MessMate Purple appearance (not the phone setting). */
const HINTS: Partial<Record<ThemePreference, string>> = { system: 'MessMate Purple' };

/** Light / Dark / System — applies immediately; saved on this device. Selected option has a check mark (not colour only). */
export function ThemeSelector() {
  const { preference, setPreference } = useAppTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {THEME_PREFERENCES.map((p) => {
        const on = preference === p;
        return (
          <Pressable key={p} onPress={() => setPreference(p)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.option, on && styles.on]}>
            <Ionicons name={on ? 'checkmark-circle' : ICONS[p]} size={20} color={on ? colors.brand600 : colors.inkMuted} />
            <View>
              <AppText style={{ fontWeight: on ? '700' : '500' }}>{THEME_LABELS[p]}</AppText>
              {HINTS[p] && <AppText variant="caption" muted style={{ fontSize: 11, lineHeight: 14 }}>{HINTS[p]}</AppText>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  on: { borderColor: colors.brand600, borderWidth: 2 },
}));
