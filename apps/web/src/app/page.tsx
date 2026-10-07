'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/ui/loader';
import { useAuth } from '@/lib/auth/auth-context';
import { homePath } from '@/lib/auth/permissions';

export default function IndexPage() {
  const { status, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
    if (status === 'authenticated' && session) router.replace(homePath(session));
  }, [status, session, router]);

  return <PageLoader />;
}
