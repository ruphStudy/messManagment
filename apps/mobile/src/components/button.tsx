import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { colors, radius, TOUCH_TARGET, themed } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = themed(() => ({
  primary: { bg: colors.brand600, fg: '#fff' },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.brand700 },
  danger: { bg: colors.danger, fg: '#fff' },
}));

export function Button({ title, variant = 'primary', loading, disabled, style, ...props }: ButtonProps) {
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        { backgroundColor: isDisabled && variant === 'primary' ? colors.disabled : p.bg, borderColor: p.border ?? 'transparent' },
        variant === 'primary' && !isDisabled && { shadowColor: colors.brand600, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
        state.pressed && { opacity: 0.85 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : <Text style={[styles.label, { color: p.fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: { fontSize: 16, fontWeight: '700' },
});
