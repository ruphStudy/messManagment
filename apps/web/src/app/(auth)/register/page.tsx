'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronRight, GraduationCap } from 'lucide-react';
import { DEFAULT_COUNTRY_CODE, firstError, LIMITS, MESSAGES, validators, type RegisterOwnerRequest } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/modal';
import { StudentOtpForm } from '@/components/auth/student-otp-form';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useForm } from '@/lib/use-form';

const TEAM_NOTE = 'Manager or staff member? Your mess owner creates your account. Use Sign in after they add you.';

/** Owner signup: creates an owner account only; ownership comes from creating a NEW mess during setup. */
function OwnerSignup() {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const form = useForm({
    initial: { firstName: '', lastName: '', mobile: '', email: '', password: '', confirmPassword: '' },
    validate: (v) => ({
      firstName: firstError(v.firstName, validators.required, validators.maxLength(LIMITS.nameMax)),
      lastName: firstError(v.lastName, validators.required, validators.maxLength(LIMITS.nameMax)),
      mobile: firstError(v.mobile, validators.required, validators.mobile),
      email: firstError(v.email, validators.required, validators.email),
      password: firstError(v.password, validators.required, validators.password),
      confirmPassword: v.confirmPassword === v.password ? undefined : MESSAGES.passwordMismatch,
    }),
  });

  const register = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setConfirming(false);
    const body: RegisterOwnerRequest = { ...values, email: values.email.trim().toLowerCase() };
    await api('/auth/register/owner', { method: 'POST', body, auth: false });
    toast.success('Account created', 'Sign in to set up your mess.');
    router.push(`/login?registered=1&identifier=${encodeURIComponent(body.mobile)}`);
  });
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.validateFields()) setConfirming(true);
  };

  const field = (key: keyof typeof form.values) => ({
    id: key,
    value: form.values[key],
    error: form.errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => form.setField(key, e.target.value),
    onBlur: () => form.values[key] && form.validateFields([key]),
  });

  return (
    <>
      <Link href="/register" className="text-sm font-medium text-brand-700 hover:underline">← Back</Link>
      <h1 className="mt-2 text-display font-bold">Create a Mess Owner account</h1>
      <p className="mt-1 text-ink-muted">Start managing your mess in a few minutes.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input {...field('firstName')} label="First name" autoComplete="given-name" required />
          <Input {...field('lastName')} label="Last name" autoComplete="family-name" required />
        </div>
        <Input
          {...field('mobile')}
          label="Mobile number"
          prefix={DEFAULT_COUNTRY_CODE}
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          required
          onChange={(e) => form.setField('mobile', e.target.value.replace(/\D/g, ''))}
        />
        <Input {...field('email')} label="Email" type="email" autoComplete="email" required />
        <Input
          {...field('password')}
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number"
          required
        />
        <Input {...field('confirmPassword')} label="Confirm password" type="password" autoComplete="new-password" required />

        {form.formError && <Alert tone="danger">{form.formError}</Alert>}

        <Button type="submit" size="lg" fullWidth loading={form.submitting}>
          Create account
        </Button>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Create a Mess Owner account?"
        description="This account is for people who operate a mess business. You will create and manage your own mess. Owner plans may require payment after the applicable trial period."
        confirmLabel="Create owner account"
        loading={form.submitting}
        onConfirm={() => void register()}
        onCancel={() => setConfirming(false)}
      />

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

function StudentSignup() {
  return (
    <>
      <Link href="/register" className="text-sm font-medium text-brand-700 hover:underline">← Back</Link>
      <h1 className="mt-2 text-display font-bold">Student / member account</h1>
      <p className="mt-1 text-ink-muted">
        Verify your mobile number. If your mess has already added this number, you&apos;re connected right away; if not, your
        account waits until they do — no need to sign up again.
      </p>
      <StudentOtpForm submitLabel="Create account" />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login/otp" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </>
  );
}

const CHOICES = [
  {
    as: 'owner',
    icon: Building2,
    title: 'I own a mess',
    description: 'Create and manage my own mess.',
    note: 'Mess Owner plans may require a paid subscription after the trial period.',
  },
  { as: 'student', icon: GraduationCap, title: 'I am a student / member', description: 'Join and use a mess where I am registered.', note: null },
] as const;

function SignupChoice() {
  return (
    <>
      <h1 className="text-display font-bold">How will you use MessMate?</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {CHOICES.map((c) => (
          <li key={c.as}>
            <Link href={`/register?as=${c.as}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-brand-300 hover:bg-brand-50">
              <c.icon className="size-8 shrink-0 text-brand-600" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-sm text-ink-muted">{c.description}</span>
                {c.note && <span className="mt-1 block text-xs text-ink-muted">{c.note}</span>}
              </span>
              <ChevronRight className="size-5 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-muted">{TEAM_NOTE}</p>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </>
  );
}

function RegisterScreen() {
  const as = useSearchParams().get('as');
  return as === 'owner' ? <OwnerSignup /> : as === 'student' ? <StudentSignup /> : <SignupChoice />;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterScreen />
    </Suspense>
  );
}
