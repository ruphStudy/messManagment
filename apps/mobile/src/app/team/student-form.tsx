import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { businessToday, firstError, LIMITS, normalizeMobile, validators, type StudentDetail } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { isDate } from '@/lib/team';

const FIELDS = [
  { key: 'firstName', label: 'First name *' },
  { key: 'lastName', label: 'Last name' },
  { key: 'mobile', label: 'Mobile *' },
  { key: 'joiningDate', label: 'Joining date (YYYY-MM-DD) *' },
  { key: 'collegeName', label: 'College' },
  { key: 'courseName', label: 'Course' },
  { key: 'hostelOrPg', label: 'Hostel / PG' },
  { key: 'parentName', label: 'Parent name' },
  { key: 'parentMobile', label: 'Parent mobile' },
  { key: 'notes', label: 'Notes (team only)' },
] as const;
type Key = (typeof FIELDS)[number]['key'];

/** Add or edit a student (same API and validation as the web; the server re-checks everything). */
export default function StudentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toast = useToast();
  const [values, setValues] = useState<Record<Key, string> | null>(id ? null : { firstName: '', lastName: '', mobile: '', joiningDate: businessToday(), collegeName: '', courseName: '', hostelOrPg: '', parentName: '', parentMobile: '', notes: '' });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<StudentDetail>(`/students/${id}`).then((s) => setValues(Object.fromEntries(FIELDS.map(({ key }) => [key, (s[key] as string | null) ?? ''])) as Record<Key, string>)).catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  }, [id, toast]);
  if (!values) return <FullScreenLoader />;

  const save = async () => {
    const next = {
      firstName: firstError(values.firstName.trim(), validators.required, validators.maxLength(LIMITS.nameMax)),
      mobile: firstError(values.mobile, validators.required, validators.mobile),
      joiningDate: isDate(values.joiningDate) ? undefined : 'Use YYYY-MM-DD',
      parentMobile: validators.optionalMobile(values.parentMobile),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    const body = Object.fromEntries(FIELDS.map(({ key }) => [key, key === 'mobile' || key === 'parentMobile' ? normalizeMobile(values[key]) ?? (values[key].trim() || null) : values[key].trim() || null]));
    try {
      const saved = await api<StudentDetail>(id ? `/students/${id}` : '/students', { method: id ? 'PATCH' : 'POST', body });
      toast.show(id ? 'Student updated' : 'Student added', 'success');
      router.replace({ pathname: '/team/student', params: { id: saved.id } });
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card>
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            value={values[key]}
            error={errors[key]}
            keyboardType={key.toLowerCase().includes('mobile') ? 'phone-pad' : 'default'}
            multiline={key === 'notes'}
            onChangeText={(t) => { setValues((v) => (v ? { ...v, [key]: t } : v)); setErrors((x) => ({ ...x, [key]: undefined })); }}
          />
        ))}
        <AppText variant="caption" muted>If this number already has the student app, it links automatically.</AppText>
        <Button title={id ? 'Save changes' : 'Add student'} onPress={save} loading={saving} />
      </Card>
    </Screen>
  );
}
