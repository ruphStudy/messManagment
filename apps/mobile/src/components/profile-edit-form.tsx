import { useState } from 'react';
import { View } from 'react-native';
import { firstError, LIMITS, validators, type StudentSelfProfile, type StudentSelfUpdate } from '@mess/shared';
import { errorMessage } from '@/lib/api';
import { colors, spacing } from '@/theme/tokens';
import { Button } from './button';
import { Card } from './layout';
import { AppText } from './text';
import { TextField } from './text-field';

type Values = { [K in keyof StudentSelfUpdate]: string };

const FIELDS: { key: keyof Values; label: string; max: number; keyboard?: 'email-address' }[] = [
  { key: 'email', label: 'Email', max: LIMITS.emailMax, keyboard: 'email-address' },
  { key: 'collegeName', label: 'College', max: LIMITS.textMax },
  { key: 'courseName', label: 'Course', max: LIMITS.textMax },
  { key: 'hostelOrPg', label: 'Hostel / PG', max: LIMITS.textMax },
  { key: 'localAddress', label: 'Local address', max: LIMITS.addressMax },
];

interface Props {
  profile: StudentSelfProfile;
  onSave: (input: StudentSelfUpdate) => Promise<void>;
  onCancel: () => void;
}

/** Students may edit only these low-risk fields; the API rejects anything else. */
export function ProfileEditForm({ profile, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, profile[key] ?? ''])) as Values,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next: typeof errors = {};
    for (const { key, max } of FIELDS) {
      next[key] = key === 'email' ? validators.optionalEmail(values.email) : firstError(values[key].trim(), validators.maxLength(max));
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    setFormError(undefined);
    try {
      await onSave(
        Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim() || null])) as StudentSelfUpdate,
      );
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: spacing.lg }}>
      <AppText variant="title">Edit your details</AppText>
      {FIELDS.map(({ key, label, keyboard }) => (
        <TextField
          key={key}
          label={label}
          value={values[key]}
          error={errors[key]}
          keyboardType={keyboard}
          autoCapitalize={keyboard ? 'none' : 'words'}
          multiline={key === 'localAddress'}
          onChangeText={(text) => {
            setValues((v) => ({ ...v, [key]: text }));
            setErrors((e) => ({ ...e, [key]: undefined }));
          }}
        />
      ))}
      <AppText variant="caption" muted>
        To change your name, mobile number or joining date, please contact your mess.
      </AppText>
      {formError && <AppText style={{ color: colors.danger }}>{formError}</AppText>}
      <View style={{ gap: spacing.sm }}>
        <Button title="Save" onPress={save} loading={saving} />
        <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
      </View>
    </Card>
  );
}
