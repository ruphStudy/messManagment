import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';

export default function ForgotPasswordPage() {
  return (
    <EmptyState
      icon={KeyRound}
      title="Password reset is coming soon"
      description="For now, please contact support to reset your password."
      action={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    />
  );
}
