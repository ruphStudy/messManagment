import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_COUNTRY_CODE, firstError, validators } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/theme/tokens';

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
        <AppText muted>Sign in with your mobile number to see your mess details.</AppText>
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
        We will send a one-time code to this number.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  note: { textAlign: 'center' },
});
