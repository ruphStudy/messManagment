'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DEFAULT_COUNTRY_CODE, MESSAGES, normalizeMobile, OTP_LENGTH, validators, type RequestOtpResponse } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useForm } from '@/lib/use-form';

/** Team accounts: OTP to the registered mobile, then a new password. Signs out every existing session. */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'mobile' | 'reset' | 'done'>('mobile');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const mobileForm = useForm({
    initial: { mobile: '' },
    validate: (v) => ({ mobile: validators.required(v.mobile) ?? validators.mobile(v.mobile) }),
  });
  const resetForm = useForm({
    initial: { code: '', newPassword: '', confirmPassword: '' },
    validate: (v) => ({
      code: new RegExp(`^\\d{${OTP_LENGTH}}$`).test(v.code.trim()) ? undefined : MESSAGES.otp,
      newPassword: validators.required(v.newPassword) ?? validators.password(v.newPassword),
      confirmPassword: v.confirmPassword !== v.newPassword ? MESSAGES.passwordMismatch : undefined,
    }),
  });
  const mobile = normalizeMobile(mobileForm.values.mobile) ?? mobileForm.values.mobile;

  const requestCode = mobileForm.handleSubmit(async () => {
    const res = await api<RequestOtpResponse>('/auth/password-reset/request', { method: 'POST', auth: false, body: { mobile } });
    setDevOtp(res.devOtp ?? null);
    setStep('reset');
  });
  const confirm = resetForm.handleSubmit(async (v) => {
    await api('/auth/password-reset/confirm', { method: 'POST', auth: false, body: { mobile, code: v.code.trim(), newPassword: v.newPassword } });
    setStep('done');
  });

  return (
    <>
      <h1 className="text-display font-bold">Reset password</h1>
      {step === 'mobile' && (
        <>
          <p className="mt-1 text-ink-muted">For mess owners, managers and staff. We&apos;ll send a code to your registered mobile number.</p>
          <form onSubmit={requestCode} noValidate className="mt-6 flex flex-col gap-4">
            <Input id="mobile" label="Mobile number" prefix={DEFAULT_COUNTRY_CODE} inputMode="numeric" maxLength={10} autoComplete="tel" value={mobileForm.values.mobile} error={mobileForm.errors.mobile} onChange={(e) => mobileForm.setField('mobile', e.target.value)} />
            {mobileForm.formError && <Alert tone="danger">{mobileForm.formError}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={mobileForm.submitting}>Send code</Button>
          </form>
        </>
      )}
      {step === 'reset' && (
        <>
          <p className="mt-1 text-ink-muted">If {DEFAULT_COUNTRY_CODE} {mobile} has a team account, a {OTP_LENGTH}-digit code was sent to it.</p>
          {devOtp && <Alert tone="info" className="mt-4">Development code: {devOtp}</Alert>}
          <form onSubmit={confirm} noValidate className="mt-6 flex flex-col gap-4">
            <Input id="code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_LENGTH} value={resetForm.values.code} error={resetForm.errors.code} onChange={(e) => resetForm.setField('code', e.target.value)} />
            <Input id="newPassword" type="password" autoComplete="new-password" label="New password" hint={MESSAGES.password} value={resetForm.values.newPassword} error={resetForm.errors.newPassword} onChange={(e) => resetForm.setField('newPassword', e.target.value)} />
            <Input id="confirmPassword" type="password" autoComplete="new-password" label="Confirm new password" value={resetForm.values.confirmPassword} error={resetForm.errors.confirmPassword} onChange={(e) => resetForm.setField('confirmPassword', e.target.value)} />
            {resetForm.formError && <Alert tone="danger">{resetForm.formError}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={resetForm.submitting}>Set new password</Button>
            <button type="button" onClick={() => setStep('mobile')} className="text-sm font-medium text-brand-700 hover:underline">Use a different number</button>
          </form>
        </>
      )}
      {step === 'done' && (
        <Alert tone="success" className="mt-6">Your password was changed and you were signed out everywhere. Sign in with your new password.</Alert>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
