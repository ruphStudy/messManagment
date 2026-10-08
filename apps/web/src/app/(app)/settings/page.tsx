'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { can, MessStatus, Permission, type MessProfile } from '@mess/shared';
import { AccountSettings } from '@/components/settings/account-settings';
import { MealSettingsForm, MessProfileForm } from '@/components/settings/mess-settings-forms';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { useListParams } from '@/lib/use-list-params';

type Tab = 'profile' | 'meals' | 'staff' | 'account';
const TAB_LABELS: Record<Tab, string> = { profile: 'Mess profile', meals: 'Meals & timings', staff: 'Staff & access', account: 'Account & security' };

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="mb-3 h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

function MessTab({ tab }: { tab: 'profile' | 'meals' }) {
  const [mess, setMess] = useState<MessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api<MessProfile>('/mess').then(setMess).catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState title="Couldn't load your mess" description={error} onRetry={load} />;
  if (!mess) return <SettingsSkeleton />;
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-ink-muted">Mess status</span>
        <Badge tone={mess.status === MessStatus.ACTIVE ? 'success' : 'danger'}>{mess.status === MessStatus.ACTIVE ? 'Active' : 'Suspended'}</Badge>
      </div>
      {tab === 'profile' ? <MessProfileForm key={mess.updatedAt} mess={mess} onSaved={setMess} /> : <MealSettingsForm key={mess.updatedAt} mess={mess} onSaved={setMess} />}
    </>
  );
}

function SettingsScreen() {
  const { session } = useAuth();
  const list = useListParams();
  // Staff only manage their own account; owners/managers also see mess and team settings.
  const tabs: Tab[] = [
    ...(can(session?.role, Permission.MESS_SETTINGS_UPDATE) ? (['profile', 'meals'] as const) : []),
    ...(can(session?.role, Permission.STAFF_VIEW) ? (['staff'] as const) : []),
    'account',
  ];
  const requested = list.get('tab') as Tab;
  const tab = session?.user.mustChangePassword ? 'account' : tabs.includes(requested) ? requested : tabs[0];

  return (
    <>
      <PageHeader title="Settings" description={tabs.length > 1 ? 'Your mess, team and account' : 'Your account'} />
      {tabs.length > 1 && (
        <nav aria-label="Settings sections" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/settings?tab=${t}`}
              aria-current={tab === t ? 'page' : undefined}
              className={cn('inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold', tab === t ? 'bg-ink text-white' : 'border border-border bg-surface text-ink-muted hover:bg-canvas')}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </nav>
      )}
      {tab === 'profile' || tab === 'meals' ? (
        <MessTab key={tab} tab={tab} />
      ) : tab === 'staff' ? (
        <Link href="/staff" className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-brand-300">
          <Users className="size-6 text-brand-600" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">Manage team</span>
            <span className="block text-sm text-ink-muted">Add managers and staff, change roles, deactivate access or reset passwords.</span>
          </span>
          <ChevronRight className="size-5 text-ink-muted" aria-hidden />
        </Link>
      ) : (
        <AccountSettings />
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
