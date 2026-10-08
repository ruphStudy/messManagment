import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, type ComplaintCounts, type ComplaintListItem, type FeedbackItem, type RatingSummary } from './feedback';
import type { ExpectedMeals, PauseRecord } from './pauses';
import type { Expense, FinanceMonthlySummary } from './expenses';
import type { AttendanceRecord } from './attendance';
import { BUSINESS_TIME_ZONE, SUBSCRIPTION_STATUS_LABELS, type SubscriptionListItem, type SubscriptionStatus } from './meal-plans';
import { MEAL_LABELS, type MealKey } from './menus';
import { formatPaise, paiseToInput, PAYMENT_METHOD_LABELS, type DueItem, type PaymentRecord } from './payments';
import { STUDENT_STATUS_LABELS, type StudentListItem } from './students';
import { Permission } from './roles';

// ── Dashboard ──

export type MenuStatusToday = 'NOT_CREATED' | 'DRAFT' | 'PUBLISHED';

export interface DashboardActionItem {
  key: 'MENU_NOT_PUBLISHED' | 'EXPIRING_PLANS' | 'STUDENTS_WITH_DUES' | 'OPEN_COMPLAINTS';
  label: string;
  count: number;
  href: string;
}

/**
 * One response for the whole dashboard. Sections the caller may not see are omitted (not zeroed):
 * staff get only the operational parts (meals, menu).
 */
export interface DashboardOverview {
  dates: { today: string; tomorrow: string; month: string };
  meals: { today: ExpectedMeals; tomorrow: ExpectedMeals };
  menu: { status: MenuStatusToday };
  students?: { active: number; inactive: number; joinedThisMonth: number };
  subscriptions?: { active: number; upcoming: number; expiringSoon: number; endedWithoutRenewal: number };
  money?: {
    collectedTodayPaise: number;
    collectedThisMonthPaise: number;
    pendingDuesPaise: number;
    studentsWithDues: number;
    expensesTodayPaise: number;
    expensesThisMonthPaise: number;
    /** Same rules as /finance/monthly-summary (collected − expenses). Not accounting profit. */
    balance: FinanceMonthlySummary;
  };
  feedback?: { monthAverage: number | null; monthCount: number; averages: RatingSummary['averages'] };
  complaints?: ComplaintCounts & { resolvedThisMonth: number };
  actionItems: DashboardActionItem[];
}

// ── Reports ──

export const ReportType = {
  STUDENTS: 'students',
  ATTENDANCE: 'attendance',
  PAUSES: 'pauses',
  SUBSCRIPTIONS: 'subscriptions',
  PAYMENTS: 'payments',
  DUES: 'dues',
  EXPENSES: 'expenses',
  FEEDBACK: 'feedback',
  COMPLAINTS: 'complaints',
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

/** Who may open/export each report. Financial reports need FINANCE_VIEW (owner/manager only). */
export const REPORT_PERMISSIONS: Record<ReportType, Permission> = {
  students: Permission.STUDENT_VIEW,
  attendance: Permission.ATTENDANCE_VIEW,
  pauses: Permission.PAUSE_VIEW,
  subscriptions: Permission.FINANCE_VIEW,
  payments: Permission.FINANCE_VIEW,
  dues: Permission.FINANCE_VIEW,
  expenses: Permission.EXPENSE_VIEW,
  feedback: Permission.FEEDBACK_VIEW,
  complaints: Permission.COMPLAINT_VIEW,
};

export const REPORT_INFO: Record<ReportType, { title: string; description: string }> = {
  students: { title: 'Students', description: 'Everyone in your mess with their current plan.' },
  attendance: { title: 'Attendance', description: 'Meals served, by day and meal.' },
  pauses: { title: 'Meal pauses', description: 'Who paused which meal, and why.' },
  subscriptions: { title: 'Subscriptions', description: 'Plans, dates, meals left and fees.' },
  payments: { title: 'Payments', description: 'Money received, with receipt numbers.' },
  dues: { title: 'Pending dues', description: 'Who still owes money, and how much.' },
  expenses: { title: 'Expenses', description: 'Money spent, by category.' },
  feedback: { title: 'Feedback', description: 'Meal ratings and general feedback.' },
  complaints: { title: 'Complaints', description: 'Complaints and how they were handled.' },
};

export const REPORT_LIMITS = {
  /** Longest custom date range a report accepts. */
  maxRangeDays: 366,
  /** Most rows one CSV export may contain. */
  exportMaxRows: 10_000,
} as const;

/** Values that make spreadsheets treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: strings that could run as a formula are prefixed with an apostrophe (CSV injection guard),
 * and anything containing quotes, commas, line breaks or edge spaces is quoted.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  // BOM so Excel opens UTF-8 (Hindi/Marathi names) correctly.
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ── Report rows, totals and columns (shared by the on-screen table and the CSV export) ──

export type StudentReportRow = StudentListItem & { currentPlan: { name: string; status: SubscriptionStatus; endDate: string } | null };

export interface ReportRows {
  students: StudentReportRow;
  attendance: AttendanceRecord;
  pauses: PauseRecord;
  subscriptions: SubscriptionListItem;
  payments: PaymentRecord;
  dues: DueItem;
  expenses: Expense;
  feedback: FeedbackItem;
  complaints: ComplaintListItem;
}

/** Totals over the whole filtered set (not just the current page). Reversed rows are never counted. */
export interface ReportSummaries {
  students: undefined;
  attendance: Record<MealKey, number> & { total: number };
  pauses: { active: Record<MealKey, number>; activeTotal: number; cancelled: number };
  subscriptions: undefined;
  payments: { collectedPaise: number; recordedCount: number; reversedCount: number };
  dues: { duePaise: number; studentsOwing: number };
  expenses: { totalPaise: number; recordedCount: number; reversedCount: number };
  feedback: RatingSummary;
  complaints: ComplaintCounts;
}

type CellValue = string | number | null | undefined;

export interface ReportColumn<Row> {
  header: string;
  /** money: integer paise; datetime: ISO timestamp; date: YYYY-MM-DD. */
  kind?: 'money' | 'datetime' | 'date';
  value: (row: Row) => CellValue;
}

const personName = (p: { firstName: string; lastName: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(' ');
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
const meal = (m: string | null) => (m ? MEAL_LABELS[m as MealKey] : null);

export const REPORT_COLUMNS: { [T in ReportType]: ReportColumn<ReportRows[T]>[] } = {
  students: [
    { header: 'Name', value: personName },
    { header: 'Mobile', value: (r) => r.mobile },
    { header: 'College', value: (r) => r.collegeName },
    { header: 'Hostel / PG', value: (r) => r.hostelOrPg },
    { header: 'Joining date', kind: 'date', value: (r) => r.joiningDate },
    { header: 'Status', value: (r) => STUDENT_STATUS_LABELS[r.status] },
    { header: 'App linked', value: (r) => yesNo(r.appLinked) },
    { header: 'Current plan', value: (r) => r.currentPlan?.name },
    { header: 'Plan status', value: (r) => r.currentPlan && SUBSCRIPTION_STATUS_LABELS[r.currentPlan.status] },
    { header: 'Plan ends', kind: 'date', value: (r) => r.currentPlan?.endDate },
  ],
  attendance: [
    { header: 'Date', kind: 'date', value: (r) => r.date },
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Meal', value: (r) => meal(r.mealType) },
    { header: 'Plan', value: (r) => r.planName },
    { header: 'Source', value: (r) => (r.source === 'QR' ? 'QR' : 'Manual') },
    { header: 'Served at', kind: 'datetime', value: (r) => r.servedAt },
    { header: 'Status', value: (r) => (r.status === 'REVERSED' ? 'Reversed' : 'Served') },
    { header: 'Meal credit used', value: (r) => yesNo(r.creditDeducted) },
  ],
  pauses: [
    { header: 'Date', kind: 'date', value: (r) => r.date },
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Meal', value: (r) => meal(r.mealType) },
    { header: 'Status', value: (r) => (r.status === 'ACTIVE' ? 'Paused' : 'Cancelled') },
    { header: 'Reason', value: (r) => r.reason },
    { header: 'Added by', value: (r) => (r.source === 'STUDENT' ? 'Student' : (r.createdBy ?? 'Mess')) },
    { header: 'Created', kind: 'datetime', value: (r) => r.createdAt },
    { header: 'Cancelled', kind: 'datetime', value: (r) => r.cancelledAt },
  ],
  subscriptions: [
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Plan', value: (r) => r.plan.name },
    { header: 'Start', kind: 'date', value: (r) => r.startDate },
    { header: 'End', kind: 'date', value: (r) => r.endDate },
    { header: 'Status', value: (r) => SUBSCRIPTION_STATUS_LABELS[r.status] },
    { header: 'Total meals', value: (r) => r.totalMealCredits ?? 'Unlimited' },
    { header: 'Meals left', value: (r) => r.remainingMealCredits ?? 'Unlimited' },
    { header: 'Fee', kind: 'money', value: (r) => r.payment.payablePaise },
    { header: 'Paid', kind: 'money', value: (r) => r.payment.paidPaise },
    { header: 'Due', kind: 'money', value: (r) => r.payment.duePaise },
  ],
  payments: [
    { header: 'Receipt no.', value: (r) => r.receiptNumber },
    { header: 'Date', kind: 'date', value: (r) => r.paymentDate },
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Plan', value: (r) => r.subscription.planName },
    { header: 'Amount', kind: 'money', value: (r) => r.amountPaise },
    { header: 'Method', value: (r) => PAYMENT_METHOD_LABELS[r.method] },
    { header: 'Reference', value: (r) => r.referenceNumber },
    { header: 'Recorded by', value: (r) => r.recordedBy },
    { header: 'Status', value: (r) => (r.status === 'REVERSED' ? 'Reversed' : 'Received') },
  ],
  dues: [
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Plan', value: (r) => r.planName },
    { header: 'Start', kind: 'date', value: (r) => r.startDate },
    { header: 'End', kind: 'date', value: (r) => r.endDate },
    { header: 'Plan status', value: (r) => SUBSCRIPTION_STATUS_LABELS[r.subscriptionStatus] },
    { header: 'Fee', kind: 'money', value: (r) => r.payment.payablePaise },
    { header: 'Paid', kind: 'money', value: (r) => r.payment.paidPaise },
    { header: 'Due', kind: 'money', value: (r) => r.payment.duePaise },
  ],
  expenses: [
    { header: 'Date', kind: 'date', value: (r) => r.expenseDate },
    { header: 'Category', value: (r) => r.category.name },
    { header: 'Title', value: (r) => r.title },
    { header: 'Vendor', value: (r) => r.vendorName },
    { header: 'Amount', kind: 'money', value: (r) => r.amountPaise },
    { header: 'Method', value: (r) => (r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] : null) },
    { header: 'Reference', value: (r) => r.referenceNumber },
    { header: 'Recorded by', value: (r) => r.recordedBy },
    { header: 'Status', value: (r) => (r.status === 'REVERSED' ? 'Reversed' : 'Counted') },
  ],
  feedback: [
    { header: 'Date', kind: 'date', value: (r) => r.date },
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Type', value: (r) => (r.type === 'MEAL' ? 'Meal' : 'General') },
    { header: 'Meal', value: (r) => meal(r.mealType) },
    { header: 'Overall', value: (r) => r.overallRating },
    { header: 'Taste', value: (r) => r.tasteRating },
    { header: 'Quality', value: (r) => r.qualityRating },
    { header: 'Quantity', value: (r) => r.quantityRating },
    { header: 'Cleanliness', value: (r) => r.cleanlinessRating },
    { header: 'Comment', value: (r) => r.comment },
    { header: 'Counted in averages', value: (r) => yesNo(!r.mealReversed) },
  ],
  complaints: [
    { header: 'Created', kind: 'datetime', value: (r) => r.createdAt },
    { header: 'Student', value: (r) => personName(r.student) },
    { header: 'Mobile', value: (r) => r.student.mobile },
    { header: 'Category', value: (r) => COMPLAINT_CATEGORY_LABELS[r.category] },
    { header: 'Status', value: (r) => COMPLAINT_STATUS_LABELS[r.status] },
    { header: 'Description', value: (r) => r.description },
    { header: 'Replies', value: (r) => r.responseCount },
    { header: 'Resolved', kind: 'datetime', value: (r) => r.resolvedAt },
    // Photos are never exported, only whether one exists.
    { header: 'Has photo', value: (r) => yesNo(r.hasAttachment) },
  ],
};

const reportDateTime = new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });
const reportDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', dateStyle: 'medium' });

/** CSV header: money columns say they are in rupees. */
export function reportCsvHeader(column: ReportColumn<never>): string {
  return column.kind === 'money' ? `${column.header} (₹)` : column.header;
}

/** CSV value: plain rupee amounts (1234.50), ISO dates, IST timestamps — easy to sort/sum in a spreadsheet. */
export function reportCsvValue<Row>(column: ReportColumn<Row>, row: Row): CellValue {
  const v = column.value(row);
  if (v === null || v === undefined) return v;
  if (column.kind === 'money') return paiseToInput(Number(v));
  if (column.kind === 'datetime') return reportDateTime.format(new Date(String(v)));
  return v;
}

/** On-screen value: ₹1,234.50, "9 Oct 2026", "9 Oct 2026, 1:05 pm"; empty → "—". */
export function reportDisplayValue<Row>(column: ReportColumn<Row>, row: Row): string {
  const v = column.value(row);
  if (v === null || v === undefined || v === '') return '—';
  if (column.kind === 'money') return formatPaise(Number(v));
  if (column.kind === 'datetime') return reportDateTime.format(new Date(String(v)));
  if (column.kind === 'date') return reportDate.format(new Date(`${v}T00:00:00Z`));
  return String(v);
}
