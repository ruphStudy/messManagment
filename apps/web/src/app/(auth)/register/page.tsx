'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_COUNTRY_CODE, firstError, LIMITS, MESSAGES, validators, type RegisterOwnerRequest } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useForm } from '@/lib/use-form';

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();

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

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    const body: RegisterOwnerRequest = { ...values, email: values.email.trim().toLowerCase() };
    await api('/auth/register', { method: 'POST', body, auth: false });
    toast.success('Account created', 'Sign in to continue.');
    router.push(`/login?registered=1&identifier=${encodeURIComponent(body.mobile)}`);
  });

  const field = (key: keyof typeof form.values) => ({
    id: key,
    value: form.values[key],
    error: form.errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => form.setField(key, e.target.value),
    onBlur: () => form.values[key] && form.validateFields([key]),
  });

  return (
    <>
      <h1 className="text-display font-bold">Create your account</h1>
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

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
