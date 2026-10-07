import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { AppText } from './text';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, hint, prefix, style, ...props }, ref) {
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.box, error ? styles.boxError : null]}>
        {prefix && (
          <AppText muted style={styles.prefix}>
            {prefix}
          </AppText>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          style={[styles.input, style]}
          {...props}
        />
      </View>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  boxError: { borderColor: colors.danger },
  prefix: { marginRight: spacing.sm, fontSize: 18 },
  input: { flex: 1, fontSize: 18, color: colors.ink, paddingVertical: spacing.md },
});
