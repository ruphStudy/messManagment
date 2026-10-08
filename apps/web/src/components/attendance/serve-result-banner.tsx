import { CheckCircle2, WifiOff, XCircle } from 'lucide-react';
import { MEAL_LABELS, type ServeResult } from '@mess/shared';
import { fullName } from '@/lib/format';

export type BannerState = { kind: 'result'; result: ServeResult } | { kind: 'network' };

/** High-contrast scan/mark feedback, readable at arm's length. */
export function ServeResultBanner({ state }: { state: BannerState }) {
  if (state.kind === 'network') {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-card bg-ink p-4 text-white">
        <WifiOff className="size-8 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-bold">Unable to verify meal</p>
          <p className="text-sm opacity-90">Check connection and try again. Do not serve until verified.</p>
        </div>
      </div>
    );
  }

  const { result } = state;
  if (result.outcome === 'SERVED') {
    const a = result.attendance;
    return (
      <div role="status" className="flex items-center gap-3 rounded-card bg-success p-4 text-white">
        <CheckCircle2 className="size-10 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{fullName(a.student)}</p>
          <p className="font-semibold">{MEAL_LABELS[a.mealType]} served ✓</p>
          <p className="text-sm opacity-90">
            {a.planName}
            {a.totalMealCredits !== null && ` · ${a.remainingMealCredits} of ${a.totalMealCredits} meals left`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="flex items-center gap-3 rounded-card bg-danger p-4 text-white">
      <XCircle className="size-10 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-xl font-bold">{result.message}</p>
        {result.student && <p className="truncate font-semibold">{fullName(result.student)}</p>}
        {result.planName && <p className="text-sm opacity-90">{result.planName}</p>}
      </div>
    </div>
  );
}
