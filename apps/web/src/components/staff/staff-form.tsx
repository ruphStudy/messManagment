'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DEFAULT_COUNTRY_CODE, LIMITS, ROLE_LABELS, STAFF_ROLE_DESCRIPTIONS, validators, type StaffRole } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/modal';
import { useForm } from '@/lib/use-form';

export type StaffFormValues = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  role: StaffRole;
  temporaryPassword: string;
};

/** Readable temporary password that meets the password rule (letters + digits, 10 chars). */
export function generateTemporaryPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join('');
  return `${pick(letters, 1).toUpperCase()}${pick(letters, 5)}${pick(digits, 4)}`;
}

export function TemporaryPasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Input
        id="temporaryPassword"
        label="Temporary password"
        value={value}
        autoComplete="off"
        error={error}
        hint="Share it in person. They must set their own password at first sign-in. It won't be shown again."
        onChange={(e) => onChange(e.target.value)}
      />
      <div>
        <Button size="sm" variant="secondary" onClick={() => onChange(generateTemporaryPassword())}>
          <RefreshCw className="size-4" aria-hidden /> Generate one
        </Button>
      </div>
    </div>
  );
}

interface Props {
  mode: 'create' | 'edit';
  initial: StaffFormValues;
  /** Roles the signed-in user may assign. */
  roles: StaffRole[];
  submitLabel: string;
  onSubmit: (values: StaffFormValues) => Promise<void>;
  onCancel?: () => void;
}

/** Add / edit a team member. Mobile is the sign-in id, so it's fixed after creation. Role changes ask for confirmation. */
export function StaffForm({ mode, initial, roles, submitLabel, onSubmit, onCancel }: Props) {
  const [confirmRole, setConfirmRole] = useState(false);
  const form = useForm<StaffFormValues>({
    initial,
    validate: (v) => ({
      firstName: validators.required(v.firstName) ?? validators.maxLength(LIMITS.nameMax)(v.firstName),
      mobile: mode === 'create' ? (validators.required(v.mobile) ?? validators.mobile(v.mobile)) : undefined,
      email: validators.optionalEmail(v.email),
      temporaryPassword: mode === 'create' && v.temporaryPassword ? validators.password(v.temporaryPassword) : undefined,
    }),
  });
  const submit = form.handleSubmit(onSubmit);
  const roleChanged = mode === 'edit' && form.values.role !== initial.role;
  const field = (key: keyof StaffFormValues) => ({ id: key, value: form.values[key], error: form.errors[key], onChange: (e: { target: { value: string } }) => form.setField(key, e.target.value as never) });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (roleChanged) setConfirmRole(true);
        else void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input {...field('firstName')} label="First name" required />
        <Input {...field('lastName')} label="Last name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          {...field('mobile')}
          label="Mobile (used to sign in)"
          prefix={DEFAULT_COUNTRY_CODE}
          inputMode="numeric"
          maxLength={10}
          required
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? 'The sign-in number cannot be changed here.' : 'If this number already has a team account, it is linked and keeps its password.'}
        />
        <Input {...field('email')} type="email" label="Email (optional)" />
      </div>
      {roles.length > 0 && (
        <RadioGroup
          name="role"
          label="Role"
          value={form.values.role}
          options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r], description: STAFF_ROLE_DESCRIPTIONS[r] }))}
          onChange={(v) => form.setField('role', v)}
        />
      )}
      {mode === 'create' && (
        <TemporaryPasswordField value={form.values.temporaryPassword} error={form.errors.temporaryPassword} onChange={(v) => form.setField('temporaryPassword', v)} />
      )}
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={form.submitting}>Cancel</Button>}
        <Button type="submit" loading={form.submitting}>{submitLabel}</Button>
      </div>

      <ConfirmDialog
        open={confirmRole}
        title={`Make them ${ROLE_LABELS[form.values.role]}?`}
        description={`${STAFF_ROLE_DESCRIPTIONS[form.values.role]} The change applies immediately.`}
        confirmLabel="Change role"
        loading={form.submitting}
        onCancel={() => setConfirmRole(false)}
        onConfirm={async () => {
          await submit();
          setConfirmRole(false);
        }}
      />
    </form>
  );
}
