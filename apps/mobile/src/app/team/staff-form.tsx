import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { firstError, LIMITS, normalizeMobile, ROLE_LABELS, STAFF_ASSIGNABLE_ROLES, STAFF_ROLE_DESCRIPTIONS, TEAM_MANAGEABLE_ROLES, validators, type CreateStaffResult, type StaffDetail, type StaffRole } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { FullScreenLoader } from '@/components/states';
import { Chips, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { generateTemporaryPassword } from '@/components/team/temp-password';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/team';

/** Add or edit a team member. Roles offered = what this user may assign (owner: manager/staff; manager: staff). */
export default function StaffFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const toast = useToast();
  const roles = STAFF_ASSIGNABLE_ROLES.filter((r) => !!session && TEAM_MANAGEABLE_ROLES[session.role].includes(r));
  const [loaded, setLoaded] = useState(!id);
  const [initialRole, setInitialRole] = useState<StaffRole | null>(null);
  const [v, setV] = useState({ firstName: '', lastName: '', mobile: '', email: '', temporaryPassword: generateTemporaryPassword() });
  const [role, setRole] = useState<StaffRole>(roles.includes('MESS_STAFF') ? 'MESS_STAFF' : roles[0]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<StaffDetail>(`/staff/${id}`).then((m) => {
      setV({ firstName: m.firstName, lastName: m.lastName ?? '', mobile: m.mobile, email: m.email ?? '', temporaryPassword: '' });
      setRole(m.role as StaffRole);
      setInitialRole(m.role as StaffRole);
      setLoaded(true);
    }).catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  }, [id, toast]);
  if (!loaded) return <FullScreenLoader />;

  const save = async () => {
    const next = {
      firstName: firstError(v.firstName.trim(), validators.required, validators.maxLength(LIMITS.nameMax)),
      mobile: id ? undefined : firstError(v.mobile, validators.required, validators.mobile),
      email: validators.optionalEmail(v.email),
      temporaryPassword: id ? undefined : validators.password(v.temporaryPassword),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      if (id) {
        await api<StaffDetail>(`/staff/${id}`, { method: 'PATCH', body: { firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, email: v.email.trim() || null, ...(role !== initialRole ? { role } : {}) } });
        toast.show('Saved', 'success');
        router.back();
      } else {
        const res = await api<CreateStaffResult>('/staff', { method: 'POST', body: { firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, mobile: normalizeMobile(v.mobile) ?? v.mobile, email: v.email.trim() || null, role, temporaryPassword: v.temporaryPassword } });
        toast.show(res.reusedAccount ? 'Existing account added; they keep their password' : 'Added. Share the temporary password in person.', 'success');
        router.replace({ pathname: '/team/staff-member', params: { id: res.staff.id } });
      }
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
      setBusy(false);
    }
  };
  const submit = () => (id && initialRole && role !== initialRole ? confirm(`Make them ${ROLE_LABELS[role]}?`, STAFF_ROLE_DESCRIPTIONS[role], 'Change role', () => void save()) : void save());

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <Card>
        <TextField label="First name *" value={v.firstName} error={errors.firstName} onChangeText={(t) => setV({ ...v, firstName: t })} />
        <TextField label="Last name" value={v.lastName} onChangeText={(t) => setV({ ...v, lastName: t })} />
        <TextField label="Mobile (sign-in) *" keyboardType="phone-pad" editable={!id} value={v.mobile} error={errors.mobile} onChangeText={(t) => setV({ ...v, mobile: t })} hint={id ? 'The sign-in number cannot be changed here.' : undefined} />
        <TextField label="Email (optional)" keyboardType="email-address" autoCapitalize="none" value={v.email} error={errors.email} onChangeText={(t) => setV({ ...v, email: t })} />
        {roles.length > 0 && (
          <>
            <SectionTitle>Role</SectionTitle>
            <Chips options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} value={role} onChange={setRole} />
            <AppText variant="caption" muted>{STAFF_ROLE_DESCRIPTIONS[role]}</AppText>
          </>
        )}
        {!id && (
          <>
            <TextField label="Temporary password" value={v.temporaryPassword} error={errors.temporaryPassword} onChangeText={(t) => setV({ ...v, temporaryPassword: t })} hint="Share it in person; they must change it at first sign-in." />
            <Button title="Generate another" variant="ghost" onPress={() => setV({ ...v, temporaryPassword: generateTemporaryPassword() })} />
          </>
        )}
        <Button title={id ? 'Save changes' : 'Add to team'} onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
