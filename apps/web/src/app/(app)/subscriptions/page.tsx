'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Repeat, SearchX, X } from 'lucide-react';
import { SubscriptionStatus, type MealPlan, type SubscriptionListItem } from '@mess/shared';
import { mealsLeftLabel, SubscriptionStatusBadge } from '@/components/subscriptions/subscription-badges';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatMobile, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const PAGE_SIZE = 20;
const VIEWS = [
  { value: '', label: 'All' },
  { value: SubscriptionStatus.ACTIVE, label: 'Active' },
  { value: 'expiring', label: 'Expiring soon' },
  { value: SubscriptionStatus.UPCOMING, label: 'Upcoming' },
  { value: SubscriptionStatus.EXPIRED, label: 'Expired' },
  { value: SubscriptionStatus.CANCELLED, label: 'Cancelled' },
];

function SubscriptionsScreen() {
  const router = useRouter();
  const list = useListParams();
  const view = list.get('view');
  const planId = list.get('plan');
  const { page, search } = list;
  const [plans, setPlans] = useState<MealPlan[]>([]);

  useEffect(() => {
    api<MealPlan[]>('/meal-plans').then(setPlans).catch(() => setPlans([]));
  }, []);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (view === 'expiring') q.set('expiringSoon', 'true');
    else if (view) q.set('status', view);
    if (planId) q.set('mealPlanId', planId);
    if (search) q.set('search', search);
    return q.toString();
  }, [page, view, planId, search]);
  const { result, error, retry } = usePagedList<SubscriptionListItem>(`/subscriptions?${apiQuery}`);

  const hasFilters = !!(view || planId || search);
  const clearFilters = () => list.clear(['view', 'plan']);
  const rows = result?.data;

  return (
    <>
      <PageHeader title="Subscriptions" description={result ? `${result.meta.total} found` : 'Who is on which plan'} />

      <div role="tablist" aria-label="Subscription status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            aria-selected={view === v.value}
            onClick={() => list.setParams({ view: v.value, page: 1 })}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium',
              view === v.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <SearchInput label="Search by student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        <Select
          id="plan"
          label="Plan"
          className="sm:w-56"
          options={[{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
          value={planId}
          onChange={(e) => list.setParams({ plan: e.target.value, page: 1 })}
        />
      </div>
      {hasFilters && (
        <button onClick={clearFilters} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load subscriptions" description={error} onRetry={retry} />
      ) : !rows ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}
        </Card>
      ) : rows.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={SearchX} title="No subscriptions match your filters." />
        ) : (
          <EmptyState
            icon={Repeat}
            title="No meal plan assigned yet."
            description="Open a student and choose “Assign plan” to start their subscription."
            action={<Link href="/students" className="font-semibold text-brand-700 hover:underline">Go to students</Link>}
          />
        )
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-canvas text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-4 py-3 font-medium">Start</th>
                  <th scope="col" className="px-4 py-3 font-medium">End</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Meals left</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => router.push(`/subscriptions/${s.id}`)} className="cursor-pointer hover:bg-canvas">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{fullName(s.student)}</p>
                      <p className="text-xs text-ink-muted">{formatMobile(s.student.mobile)}</p>
                    </td>
                    <td className="max-w-48 truncate px-4 py-3">{s.plan.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(s.startDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(s.endDate)}
                      {s.daysRemaining !== null && <p className="text-xs text-ink-muted">{s.daysRemaining} days left</p>}
                    </td>
                    <td className="px-4 py-3"><SubscriptionStatusBadge status={s.status} /></td>
                    <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">{mealsLeftLabel(s)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/subscriptions/${s.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center font-medium text-brand-700 hover:underline">
                        View <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={`/subscriptions/${s.id}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 active:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{fullName(s.student)}</span>
                      <SubscriptionStatusBadge status={s.status} />
                    </div>
                    <p className="truncate text-sm">{s.plan.name}</p>
                    <p className="text-sm text-ink-muted">
                      {formatDate(s.startDate)} – {formatDate(s.endDate)}
                      {s.daysRemaining !== null && ` · ${s.daysRemaining} days left`}
                    </p>
                    {s.totalMealCredits !== null && <p className="text-xs text-ink-muted">{mealsLeftLabel(s)}</p>}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense>
      <SubscriptionsScreen />
    </Suspense>
  );
}
