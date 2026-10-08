import {
  addDays,
  AttendanceStatus,
  businessToday,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  ExpenseStatus,
  FeedbackType,
  formatPaise,
  MEAL_KEYS,
  MEAL_LABELS,
  PauseStatus,
  PAYMENT_METHOD_LABELS,
  PaymentTransactionStatus,
  STUDENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  SubscriptionStatus,
  type ReportSummaries,
  type ReportType,
} from '@mess/shared';
import type { SelectOption } from '@/components/ui/select';

export interface ReportSelectFilter {
  /** Query parameter, sent to the API as-is. */
  key: string;
  label: string;
  /** First option is "all" (empty value). */
  options: SelectOption[];
  /** Options loaded from the API (e.g. expense categories). */
  optionsFrom?: { path: string; value: string; label: string };
}

export interface ReportScreen {
  /** Date-range query parameters, or none for point-in-time reports. */
  dates?: { from: string; to: string; label: string; required: boolean };
  searchPlaceholder?: string;
  selects: ReportSelectFilter[];
  emptyText: string;
}

const all = (label = 'All'): SelectOption => ({ value: '', label });
const fromLabels = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const meals = { key: 'mealType', label: 'Meal', options: [all('All meals'), ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))] };
const range = (label: string) => ({ from: 'from', to: 'to', label, required: true });

export const REPORT_SCREENS: Record<ReportType, ReportScreen> = {
  students: {
    dates: { from: 'joinedFrom', to: 'joinedTo', label: 'Joined', required: false },
    searchPlaceholder: 'Search name or mobile…',
    selects: [{ key: 'status', label: 'Status', options: [all(), ...fromLabels(STUDENT_STATUS_LABELS)] }],
    emptyText: 'No students match these filters.',
  },
  attendance: {
    dates: range('Meal date'),
    searchPlaceholder: 'Search student…',
    selects: [meals, { key: 'status', label: 'Status', options: [all(), { value: AttendanceStatus.SERVED, label: 'Served' }, { value: AttendanceStatus.REVERSED, label: 'Reversed' }] }],
    emptyText: 'No meals were served in this period.',
  },
  pauses: {
    dates: range('Pause date'),
    searchPlaceholder: 'Search student…',
    selects: [meals, { key: 'status', label: 'Status', options: [all(), { value: PauseStatus.ACTIVE, label: 'Paused' }, { value: PauseStatus.CANCELLED, label: 'Cancelled' }] }],
    emptyText: 'No meal pauses in this period.',
  },
  subscriptions: {
    searchPlaceholder: 'Search student…',
    selects: [
      { key: 'status', label: 'Status', options: [all(), ...fromLabels(SUBSCRIPTION_STATUS_LABELS)] },
      { key: 'expiringSoon', label: 'Ending', options: [all('Any time'), { value: 'true', label: 'Within 7 days' }] },
    ],
    emptyText: 'No subscriptions match these filters.',
  },
  payments: {
    dates: range('Payment date'),
    searchPlaceholder: 'Search student, receipt, reference…',
    selects: [
      { key: 'method', label: 'Method', options: [all('All methods'), ...fromLabels(PAYMENT_METHOD_LABELS)] },
      { key: 'status', label: 'Status', options: [all(), { value: PaymentTransactionStatus.RECORDED, label: 'Received' }, { value: PaymentTransactionStatus.REVERSED, label: 'Reversed' }] },
    ],
    emptyText: 'No payments in this period.',
  },
  dues: {
    searchPlaceholder: 'Search student…',
    selects: [
      {
        key: 'subscriptionStatus',
        label: 'Plan status',
        options: [all(), ...[SubscriptionStatus.ACTIVE, SubscriptionStatus.UPCOMING, SubscriptionStatus.EXPIRED].map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))],
      },
    ],
    emptyText: 'Nobody has pending dues. 🎉',
  },
  expenses: {
    dates: range('Expense date'),
    searchPlaceholder: 'Search title, shop, bill no…',
    selects: [
      { key: 'categoryId', label: 'Category', options: [all('All categories')], optionsFrom: { path: '/expense-categories?includeInactive=true', value: 'id', label: 'name' } },
      { key: 'paymentMethod', label: 'Paid by', options: [all('Any method'), ...fromLabels(PAYMENT_METHOD_LABELS)] },
      { key: 'status', label: 'Status', options: [all(), { value: ExpenseStatus.RECORDED, label: 'Counted' }, { value: ExpenseStatus.REVERSED, label: 'Reversed' }] },
    ],
    emptyText: 'No expenses in this period.',
  },
  feedback: {
    dates: range('Feedback date'),
    searchPlaceholder: 'Search student or comment…',
    selects: [
      { key: 'type', label: 'Type', options: [all(), { value: FeedbackType.MEAL, label: 'Meal' }, { value: FeedbackType.GENERAL, label: 'General' }] },
      meals,
      { key: 'rating', label: 'Rating', options: [all('Any rating'), ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n}★` }))] },
    ],
    emptyText: 'No feedback in this period.',
  },
  complaints: {
    dates: range('Raised on'),
    searchPlaceholder: 'Search student or text…',
    selects: [
      { key: 'status', label: 'Status', options: [all(), ...fromLabels(COMPLAINT_STATUS_LABELS)] },
      { key: 'category', label: 'Category', options: [all('All categories'), ...fromLabels(COMPLAINT_CATEGORY_LABELS)] },
    ],
    emptyText: 'No complaints in this period.',
  },
};

export interface DatePreset {
  label: string;
  from: string;
  to: string;
}

const monthEnd = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export function datePresets(today = businessToday()): DatePreset[] {
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevEnd = addDays(monthStart, -1);
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: addDays(today, -1), to: addDays(today, -1) },
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'This month', from: monthStart, to: monthEnd(today) },
    { label: 'Previous month', from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd },
  ];
}

/** Summary tiles for the filtered set. `null` when the report has no totals beyond the row count. */
export function summaryStats(type: ReportType, summary: unknown): [label: string, value: string, note?: string][] | null {
  switch (type) {
    case 'attendance': {
      const s = summary as ReportSummaries['attendance'];
      return [['Meals served', String(s.total)], ...MEAL_KEYS.map((k): [string, string] => [MEAL_LABELS[k], String(s[k])])];
    }
    case 'pauses': {
      const s = summary as ReportSummaries['pauses'];
      return [['Meals paused', String(s.activeTotal)], ...MEAL_KEYS.map((k): [string, string] => [MEAL_LABELS[k], String(s.active[k])]), ['Cancelled', String(s.cancelled), 'not counted']];
    }
    case 'payments': {
      const s = summary as ReportSummaries['payments'];
      return [['Collected', formatPaise(s.collectedPaise)], ['Payments', String(s.recordedCount)], ['Reversed', String(s.reversedCount), 'not counted']];
    }
    case 'dues': {
      const s = summary as ReportSummaries['dues'];
      return [['Total due', formatPaise(s.duePaise)], ['Students owing', String(s.studentsOwing)]];
    }
    case 'expenses': {
      const s = summary as ReportSummaries['expenses'];
      return [['Total spent', formatPaise(s.totalPaise)], ['Expenses', String(s.recordedCount)], ['Reversed', String(s.reversedCount), 'not counted']];
    }
    case 'feedback': {
      const s = summary as ReportSummaries['feedback'];
      const avg = s.averages.overall;
      return [['Average rating', avg == null ? '—' : `${avg.toFixed(1)}★`], ['Meal ratings', String(s.mealCount)], ['General feedback', String(s.generalCount)]];
    }
    case 'complaints': {
      const s = summary as ReportSummaries['complaints'];
      return [['Open', String(s.OPEN)], ['In progress', String(s.IN_PROGRESS)], ['Resolved', String(s.RESOLVED)]];
    }
    default:
      return null;
  }
}
