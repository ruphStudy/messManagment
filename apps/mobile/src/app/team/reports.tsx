import { useEffect, useState } from 'react';
import { addDays, businessToday, formatPaise, MEAL_KEYS, MEAL_LABELS, REPORT_INFO, REPORT_PERMISSIONS, type ReportSummaries, type ReportType } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { ErrorState } from '@/components/states';
import { Chips, Stats } from '@/components/team/kit';
import { AppText } from '@/components/text';
import { apiEnvelope, errorMessage } from '@/lib/api';
import { useCan } from '@/lib/team';

/** Mobile reports = read-only totals over the same report API (full tables and CSV export stay on the web). */
const TYPES: ReportType[] = ['attendance', 'payments', 'dues', 'expenses', 'complaints'];

function lines(type: ReportType, summary: unknown, total: number): { label: string; value: string | number }[] {
  switch (type) {
    case 'attendance': {
      const s = summary as ReportSummaries['attendance'];
      return [{ label: 'Meals served', value: s.total }, ...MEAL_KEYS.map((k) => ({ label: MEAL_LABELS[k], value: s[k] }))];
    }
    case 'payments': {
      const s = summary as ReportSummaries['payments'];
      return [{ label: 'Collected', value: formatPaise(s.collectedPaise) }, { label: 'Payments', value: s.recordedCount }, { label: 'Reversed (not counted)', value: s.reversedCount }];
    }
    case 'dues': {
      const s = summary as ReportSummaries['dues'];
      return [{ label: 'Total due', value: formatPaise(s.duePaise) }, { label: 'Students owing', value: s.studentsOwing }];
    }
    case 'expenses': {
      const s = summary as ReportSummaries['expenses'];
      return [{ label: 'Spent', value: formatPaise(s.totalPaise) }, { label: 'Expenses', value: s.recordedCount }, { label: 'Reversed (not counted)', value: s.reversedCount }];
    }
    case 'complaints': {
      const s = summary as ReportSummaries['complaints'];
      return [{ label: 'Open', value: s.OPEN }, { label: 'In progress', value: s.IN_PROGRESS }, { label: 'Resolved', value: s.RESOLVED }];
    }
    default:
      return [{ label: 'Rows', value: total }];
  }
}

function ReportCard({ type, from, to }: { type: ReportType; from: string; to: string }) {
  const [state, setState] = useState<{ total: number; summary: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);
    // Dues are "as of now" (no date range).
    const q = type === 'dues' ? '' : `from=${from}&to=${to}&`;
    apiEnvelope<unknown[]>(`/reports/${type}?${q}pageSize=1`)
      .then((r) => !cancelled && setState({ total: r.meta?.total ?? 0, summary: r.summary }))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [type, from, to, attempt]);
  return (
    <Card>
      <AppText variant="label">{REPORT_INFO[type].title}</AppText>
      {error ? <ErrorState title="Couldn't load" description={error} onRetry={() => setAttempt((n) => n + 1)} /> : !state ? <AppText muted>Loading…</AppText> : <Stats items={lines(type, state.summary, state.total)} />}
    </Card>
  );
}

export default function TeamReportsScreen() {
  const can = useCan();
  const today = businessToday();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('month');
  const from = range === 'today' ? today : range === 'week' ? addDays(today, -6) : `${today.slice(0, 7)}-01`;
  const types = TYPES.filter((t) => can(REPORT_PERMISSIONS[t]));
  return (
    <Screen edges={[]}>
      <Chips options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'This month' }]} value={range} onChange={setRange} />
      {types.map((t) => <ReportCard key={t} type={t} from={from} to={today} />)}
      <AppText variant="caption" muted>Detailed tables and CSV export are on MessMate web (Reports).</AppText>
    </Screen>
  );
}
