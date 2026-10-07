'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Role } from '@mess/shared';
import { Logo } from '@/components/brand';
import { MessBasicFields, MessLocationFields, MessMealFields } from '@/components/mess/mess-fields';
import { MessSummary } from '@/components/mess/mess-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';
import { emptyMessForm, MESS_SECTIONS, toMessInput, validateMess } from '@/lib/mess-form';
import { cn } from '@/lib/cn';
import { useForm } from '@/lib/use-form';

const STEPS = [
  { title: 'Basic details', description: 'Tell us about your mess', fields: MESS_SECTIONS.basic },
  { title: 'Location', description: 'Where students can find you', fields: MESS_SECTIONS.location },
  { title: 'Meals', description: 'What and when you serve', fields: MESS_SECTIONS.meals },
  { title: 'Review', description: 'Check and create your mess', fields: [] },
] as const;

function Onboarding() {
  const { session, reload, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);

  const form = useForm({
    initial: emptyMessForm({ mobile: session?.user.mobile ?? '', email: session?.user.email ?? '' }),
    validate: validateMess,
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (form.validateFields([...current.fields])) setStep((s) => s + 1);
  };

  const submit = form.handleSubmit(async (values) => {
    await api('/mess', { method: 'POST', body: toMessInput(values) });
    await reload();
    toast.success('Your mess is ready!', `${values.name.trim()} has been set up.`);
    router.replace('/dashboard');
  });

  // If the server rejects a field from an earlier step, jump back to it.
  const firstErrorStep = STEPS.findIndex((s) => s.fields.some((f) => form.errors[f]));
  useEffect(() => {
    if (firstErrorStep >= 0) setStep((s) => Math.min(s, firstErrorStep));
  }, [firstErrorStep]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 sm:py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>

      <h1 className="text-display font-bold">Set up your mess</h1>
      <p className="mt-1 text-ink-muted">
        Hi {session?.user.firstName}, this takes about a minute. You can change everything later.
      </p>

      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-brand-600' : 'bg-slate-200')} />
            <span className={cn('hidden text-xs font-medium sm:block', i === step ? 'text-ink' : 'text-ink-muted')}>
              {i < step && <Check className="mr-1 inline size-3" aria-hidden />}
              {s.title}
            </span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={isLast ? submit : (e) => (e.preventDefault(), next())}
        noValidate
        className="mt-6 rounded-card border border-border bg-surface p-5 sm:p-6"
      >
        <p className="text-sm font-medium text-brand-700">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="text-lg font-semibold">{current.title}</h2>
        <p className="mb-5 text-sm text-ink-muted">{current.description}</p>

        {step === 0 && <MessBasicFields {...form} />}
        {step === 1 && <MessLocationFields {...form} />}
        {step === 2 && <MessMealFields {...form} />}
        {step === 3 && <MessSummary values={form.values} />}

        {form.formError && (
          <Alert tone="danger" className="mt-5">
            {form.formError}
          </Alert>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || form.submitting}>
            Back
          </Button>
          <Button type="submit" size="lg" loading={form.submitting}>
            {isLast ? 'Create my mess' : 'Continue'}
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth roles={[Role.MESS_OWNER]}>
      <OnboardingGate />
    </RequireAuth>
  );
}

/** Owners who already have a mess go straight to the dashboard. */
function OnboardingGate() {
  const { session } = useAuth();
  const router = useRouter();
  const hasMess = !!session?.membership;
  useEffect(() => {
    if (hasMess) router.replace('/dashboard');
  }, [hasMess, router]);
  return hasMess ? null : <Onboarding />;
}
