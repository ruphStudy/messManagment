'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_COUNTRY_CODE, ErrorCode, MESSAGES, normalizeMobile, OTP_LENGTH, validators, type RequestOtpResponse } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { homePath } from '@/lib/auth/permissions';

/**
 * Student sign-in and signup are the same verified-mobile flow: the account is created on first use (or reused),
 * and the mess link comes only from records the mess created for this number.
 */
export function StudentOtpForm({ submitLabel = 'Continue' }: { submitLabel?: string }) {
  const { verifyOtp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordAccount, setPasswordAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const normalized = normalizeMobile(mobile) ?? mobile;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const invalid = validators.required(mobile) ?? validators.mobile(mobile);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    setPasswordAccount(false);
    try {
      const res = await api<RequestOtpResponse>('/auth/otp/request', { method: 'POST', auth: false, body: { mobile: normalized } });
      setDevOtp(res.devOtp ?? null);
      setStep('code');
    } catch (err) {
      setPasswordAccount(err instanceof ApiError && err.code === ErrorCode.PASSWORD_SIGN_IN_REQUIRED);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim())) return setError(MESSAGES.otp);
    setBusy(true);
    setError(null);
    try {
      router.replace(homePath(await verifyOtp(normalized, code.trim())));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return step === 'mobile' ? (
    <form onSubmit={send} noValidate className="mt-6 flex flex-col gap-4">
      <Input id="otp-mobile" label="Mobile number" prefix={DEFAULT_COUNTRY_CODE} inputMode="numeric" maxLength={10} autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
      {error && (
        <Alert tone="danger">
          {error}
          {passwordAccount && <> <Link href={`/login?identifier=${normalized}`} className="font-semibold underline">Sign in with password</Link></>}
        </Alert>
      )}
      <Button type="submit" size="lg" fullWidth loading={busy}>Send code</Button>
    </form>
  ) : (
    <form onSubmit={verify} noValidate className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Enter the {OTP_LENGTH}-digit code sent to {DEFAULT_COUNTRY_CODE} {normalized}.</p>
      {devOtp && <Alert tone="info">Development code: {devOtp}</Alert>}
      <Input id="otp-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_LENGTH} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" fullWidth loading={busy}>{submitLabel}</Button>
      <button type="button" onClick={() => { setStep('mobile'); setCode(''); setError(null); }} className="text-sm font-medium text-brand-700 hover:underline">Change number</button>
    </form>
  );
}
