'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MESSAGES } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';
import { homePath } from '@/lib/auth/permissions';
import { useForm } from '@/lib/use-form';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get('registered') === '1';

  const form = useForm({
    initial: { identifier: params.get('identifier') ?? '', password: '', rememberMe: true },
    validate: (v) => ({
      identifier: v.identifier.trim() ? undefined : 'Enter your mobile number or email',
      password: v.password ? undefined : MESSAGES.required,
    }),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const session = await login(values);
    const next = params.get('next');
    // Only allow same-site relative redirects.
    router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : homePath(session));
  });

  return (
    <>
      <h1 className="text-display font-bold">Welcome back</h1>
      <p className="mt-1 text-ink-muted">Sign in to manage your mess.</p>

      {registered && (
        <Alert tone="success" className="mt-5">
          Account created. Sign in to set up your mess.
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <Input
          id="identifier"
          label="Mobile number or email"
          autoComplete="username"
          inputMode="email"
          value={form.values.identifier}
          onChange={(e) => form.setField('identifier', e.target.value)}
          error={form.errors.identifier}
        />
        <Input
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={form.values.password}
          onChange={(e) => form.setField('password', e.target.value)}
          error={form.errors.password}
        />
        <div className="flex items-center justify-between gap-2">
          <Checkbox
            id="rememberMe"
            label="Keep me signed in"
            checked={form.values.rememberMe}
            onChange={(e) => form.setField('rememberMe', e.target.checked)}
          />
          <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>

        {form.formError && <Alert tone="danger">{form.formError}</Alert>}

        <Button type="submit" size="lg" fullWidth loading={form.submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New mess owner?{' '}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
