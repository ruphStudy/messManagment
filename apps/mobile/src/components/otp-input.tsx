import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { OTP_LENGTH } from '@mess/shared';
import { colors, radius, themed } from '@/theme/tokens';
import { AppText } from './text';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/** One hidden input rendered as boxes: supports paste and SMS autofill (oneTimeCode). */
export function OtpInput({ value, onChange, error, autoFocus }: OtpInputProps) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="One-time code" accessibilityHint="Enter the code sent by SMS">
      <View style={styles.row}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = i === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <View
              key={i}
              style={[styles.cell, active && styles.cellActive, error && styles.cellError]}
              importantForAccessibility="no"
            >
              <AppText variant="title">{value[i] ?? ''}</AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus={autoFocus}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cellActive: { borderColor: colors.brand500 },
  cellError: { borderColor: colors.danger },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
}));
