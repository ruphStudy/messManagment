import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { firstError, LIMITS, MESSAGES, normalizeMobile, validators } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/theme/tokens';

type Field = 'firstName' | 'lastName' | 'mobile' | 'email' | 'password' | 'confirmPassword';

/** Owner signup: an owner account only — the mess itself is created during setup (never an existing one). */
export default function RegisterOwnerScreen() {
  const { registerOwner } = useAuth();
  const [v, setV] = useState<Record<Field, string>>({ firstName: '', lastName: '', mobile: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (k: Field) => (t: string) => {
    setV((p) => ({ ...p, [k]: k === 'mobile' ? t.replace(/\D/g, '') : t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const create = async () => {
    setLoading(true);
    setFormError(undefined);
    try {
      await registerOwner({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), mobile: normalizeMobile(v.mobile) ?? v.mobile, email: v.email.trim().toLowerCase(), password: v.password });
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      setFormError(errorMessage(e));
      setLoading(false);
    }
  };

  const submit = () => {
    const next: Partial<Record<Field, string>> = {
      firstName: firstError(v.firstName, validators.required, validators.maxLength(LIMITS.nameMax)),
      lastName: firstError(v.lastName, validators.required, validators.maxLength(LIMITS.nameMax)),
      mobile: firstError(v.mobile, validators.required, validators.mobile),
      email: firstError(v.email, validators.required, validators.email),
      password: firstError(v.password, validators.required, validators.password),
      confirmPassword: v.confirmPassword === v.password ? undefined : MESSAGES.passwordMismatch,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    Alert.alert(
      'Create a Mess Owner account?',
      'This account is for people who operate a mess business. You will create and manage your own mess. Owner plans may require payment after the applicable trial period.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Create account', onPress: () => void create() }],
    );
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="display">Mess Owner account</AppText>
        <AppText muted>You&apos;ll set up your own mess after creating the account.</AppText>
      </View>
      <TextField label="First name" autoComplete="given-name" value={v.firstName} onChangeText={set('firstName')} error={errors.firstName} />
      <TextField label="Last name" autoComplete="family-name" value={v.lastName} onChangeText={set('lastName')} error={errors.lastName} />
      <TextField label="Mobile number" keyboardType="phone-pad" maxLength={10} value={v.mobile} onChangeText={set('mobile')} error={errors.mobile} />
      <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={v.email} onChangeText={set('email')} error={errors.email} />
      <TextField label="Password" secureTextEntry autoComplete="new-password" hint={MESSAGES.password} value={v.password} onChangeText={set('password')} error={errors.password} />
      <TextField label="Confirm password" secureTextEntry autoComplete="new-password" value={v.confirmPassword} onChangeText={set('confirmPassword')} error={errors.confirmPassword} />
      {formError && <AppText style={[styles.error, { color: colors.danger }]}>{formError}</AppText>}
      <Button title="Create account" onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginBottom: spacing.lg },
  error: { marginBottom: spacing.sm },
});
