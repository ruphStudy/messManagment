'use client';

import { useState } from 'react';
import { LIMITS, MESSAGES, ROLE_LABELS, validators, type AuthContext } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useForm } from '@/lib/use-form';
import { ThemeSelector } from '@/components/ui/theme-selector';

function ProfileCard({ session }: { session: AuthContext }) {
  const { reload } = useAuth();
  const toast = useToast();
  const initial = { firstName: session.user.firstName, lastName: session.user.lastName ?? '', email: session.user.email ?? '' };
  const form = useForm({
    initial,
    validate: (v) => ({
      firstName: validators.required(v.firstName) ?? validators.maxLength(LIMITS.nameMax)(v.firstName),
      email: validators.optionalEmail(v.email),
    }),
  });
  const dirty = JSON.stringify(form.values) !== JSON.stringify(initial);
  const onSubmit = form.handleSubmit(async (v) => {
    await api<AuthContext>('/auth/me', { method: 'PATCH', body: { firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, email: v.email.trim() || null } });
    await reload();
    toast.success('Your details are saved');
  });

  return (
    <Card>
      <CardHeader
        title="Your account"
        action={
          <span className="flex gap-2">
            <Badge tone="brand">{ROLE_LABELS[session.role]}</Badge>
            <Badge tone={session.user.status === 'ACTIVE' ? 'success' : 'danger'}>{session.user.status === 'ACTIVE' ? 'Active' : 'Disabled'}</Badge>
          </span>
        }
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="acc-first" label="First name" required value={form.values.firstName} error={form.errors.firstName} onChange={(e) => form.setField('firstName', e.target.value)} />
          <Input id="acc-last" label="Last name" value={form.values.lastName} onChange={(e) => form.setField('lastName', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="acc-email" type="email" label="Email (optional, can be used to sign in)" value={form.values.email} error={form.errors.email} onChange={(e) => form.setField('email', e.target.value)} />
          <Input id="acc-mobile" label="Mobile (sign-in number)" value={session.user.mobile} disabled hint="Ask the mess owner or support to change your sign-in number." />
        </div>
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <div><Button type="submit" disabled={!dirty} loading={form.submitting}>Save details</Button></div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { reload } = useAuth();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const form = useForm({
    initial: empty,
    validate: (v) => ({
      currentPassword: validators.required(v.currentPassword),
      newPassword: validators.required(v.newPassword) ?? validators.password(v.newPassword),
      confirmPassword: v.confirmPassword !== v.newPassword ? MESSAGES.passwordMismatch : undefined,
    }),
  });
  const onSubmit = form.handleSubmit(async (v) => {
    await api<AuthContext>('/auth/change-password', { method: 'POST', body: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
    form.setValues(empty);
    setDone(true);
    await reload();
    toast.success('Password changed');
  });

  return (
    <Card>
      <CardHeader title="Change password" description={`${MESSAGES.password}. Other devices are signed out after a change.`} />
      <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
        <Input id="pw-current" type="password" autoComplete="current-password" label="Current password" required value={form.values.currentPassword} error={form.errors.currentPassword} onChange={(e) => form.setField('currentPassword', e.target.value)} />
        <Input id="pw-new" type="password" autoComplete="new-password" label="New password" required value={form.values.newPassword} error={form.errors.newPassword} onChange={(e) => { setDone(false); form.setField('newPassword', e.target.value); }} />
        <Input id="pw-confirm" type="password" autoComplete="new-password" label="Confirm new password" required value={form.values.confirmPassword} error={form.errors.confirmPassword} onChange={(e) => form.setField('confirmPassword', e.target.value)} />
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        {done && <Alert tone="success">Password changed. You stay signed in here; other devices were signed out.</Alert>}
        <div><Button type="submit" loading={form.submitting}>Change password</Button></div>
      </form>
    </Card>
  );
}

/** The signed-in person's own account: name/email, role and status (read-only), password. */
export function AccountSettings() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <div className="flex flex-col gap-4">
      {session.user.mustChangePassword && (
        <Alert tone="danger">You signed in with a temporary password. Please set your own password to continue.</Alert>
      )}
      {!session.user.mustChangePassword && <ProfileCard session={session} />}
      <PasswordCard />
      <Card>
        <CardHeader title="Appearance" description="Saved on this browser. System follows your device setting." />
        <div className="max-w-md"><ThemeSelector /></div>
      </Card>
    </div>
  );
}
