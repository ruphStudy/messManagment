import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { DEFAULT_COUNTRY_CODE, OTP_LENGTH, validators } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { OtpInput } from '@/components/otp-input';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

export default function OtpScreen() {
  const params = useLocalSearchParams<{ mobile: string; resendIn?: string; devOtp?: string }>();
  const { requestOtp, verifyOtp } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [devOtp, setDevOtp] = useState(params.devOtp);
  const [secondsLeft, setSecondsLeft] = useState(Number(params.resendIn ?? 30));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  if (!params.mobile) return <Redirect href="/" />;

  const verify = async (value = code) => {
    const validation = validators.otp(value);
    if (validation) return setError(validation);
    setVerifying(true);
    setError(undefined);
    try {
      // On success the root navigator switches to the authenticated stack.
      await verifyOtp(params.mobile, value);
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(undefined);
    try {
      const res = await requestOtp(params.mobile);
      setSecondsLeft(res.resendIn);
      setDevOtp(res.devOtp);
      setCode('');
      toast.show('A new code has been sent', 'success');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">Enter code</AppText>
        <AppText muted>
          We sent a {OTP_LENGTH}-digit code to {DEFAULT_COUNTRY_CODE} {params.mobile}
        </AppText>
      </View>

      {devOtp && (
        <Card style={styles.devCard}>
          <AppText variant="caption">Development mode — your code is</AppText>
          <AppText variant="title">{devOtp}</AppText>
        </Card>
      )}

      <OtpInput
        value={code}
        error={!!error}
        autoFocus
        onChange={(v) => {
          setCode(v);
          setError(undefined);
          if (v.length === OTP_LENGTH) void verify(v);
        }}
      />
      {error && (
        <AppText variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}

      <Button title="Verify" onPress={() => verify()} loading={verifying} disabled={code.length !== OTP_LENGTH} />

      <View style={styles.resendRow}>
        {secondsLeft > 0 ? (
          <AppText muted>Resend code in {secondsLeft}s</AppText>
        ) : (
          <Button title={resending ? 'Sending…' : 'Resend code'} variant="ghost" onPress={resend} disabled={resending} />
        )}
      </View>

      <Pressable onPress={() => router.back()} style={styles.change} accessibilityRole="button">
        <AppText style={{ color: colors.brand700 }}>Change mobile number</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  devCard: { backgroundColor: colors.infoSoft, borderColor: colors.infoSoft, alignItems: 'center' },
  resendRow: { alignItems: 'center', minHeight: TOUCH_TARGET, justifyContent: 'center' },
  change: { alignItems: 'center', minHeight: TOUCH_TARGET, justifyContent: 'center' },
});
