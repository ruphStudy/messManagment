import Link from 'next/link';
import { StudentOtpForm } from '@/components/auth/student-otp-form';

export default function OtpLoginPage() {
  return (
    <>
      <h1 className="text-display font-bold">Student sign in</h1>
      <p className="mt-1 text-ink-muted">We&apos;ll send a one-time code to your mobile number.</p>
      <StudentOtpForm submitLabel="Sign in" />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Owner, manager or staff? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in with password</Link>
      </p>
    </>
  );
}
