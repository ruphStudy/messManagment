import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_COUNTRY_CODE, firstError, validators } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, spacing, themed } from '@/theme/tokens';

export default function MobileNumberScreen() {
  const { requestOtp } = useAuth();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const validation = firstError(mobile, validators.required, validators.mobile);
    if (validation) return setError(validation);
    setLoading(true);
    setError(undefined);
    try {
      const res = await requestOtp(mobile);
      router.push({
        pathname: '/otp',
        params: { mobile, resendIn: String(res.resendIn), ...(res.devOtp ? { devOtp: res.devOtp } : {}) },
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="restaurant" size={32} color="#fff" />
        </View>
        <AppText variant="display">Welcome to MessMate</AppText>
        <AppText muted>Students sign in with a one-time code sent to their mobile.</AppText>
      </View>

      <TextField
        label="Mobile number"
        prefix={DEFAULT_COUNTRY_CODE}
        placeholder="10-digit number"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={10}
        value={mobile}
        onChangeText={(t) => {
          setMobile(t.replace(/\D/g, ''));
          setError(undefined);
        }}
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
        autoFocus
      />

      <Button title="Continue" onPress={submit} loading={loading} />
      <AppText variant="caption" muted style={styles.note}>
        We will send a one-time code to this number. New students get an account automatically.
      </AppText>

      <Button title="Owner, manager or staff? Sign in with password" variant="secondary" onPress={() => router.push('/password')} />
      <Pressable onPress={() => router.push('/signup')} accessibilityRole="link" style={styles.link}>
        <AppText style={{ color: colors.brand700, fontWeight: '600' }}>New here? Create an account</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  hero: { gap: spacing.sm, marginTop: spacing.xxl, marginBottom: spacing.lg },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  note: { textAlign: 'center', marginBottom: spacing.md },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: spacing.sm },
}));
