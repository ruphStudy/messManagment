import type { PaginationQuery } from './api';
import type { SubscriptionStatus } from './meal-plans';

export const PaymentMethod = { CASH: 'CASH', UPI: 'UPI', BANK_TRANSFER: 'BANK_TRANSFER', OTHER: 'OTHER' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

/** Methods where a transaction/UTR reference makes sense. */
export const METHODS_WITH_REFERENCE: readonly PaymentMethod[] = [PaymentMethod.UPI, PaymentMethod.BANK_TRANSFER];

export const PaymentTransactionStatus = { RECORDED: 'RECORDED', REVERSED: 'REVERSED' } as const;
export type PaymentTransactionStatus = (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

/** Derived from fee vs. paid; never stored. */
export const SubscriptionPaymentStatus = { UNPAID: 'UNPAID', PARTIAL: 'PARTIAL', PAID: 'PAID' } as const;
export type SubscriptionPaymentStatus = (typeof SubscriptionPaymentStatus)[keyof typeof SubscriptionPaymentStatus];

export const PAYMENT_STATUS_LABELS: Record<SubscriptionPaymentStatus, string> = { UNPAID: 'Unpaid', PARTIAL: 'Partly paid', PAID: 'Paid' };

export const PAYMENT_LIMITS = {
  referenceMax: 60,
  noteMax: 200,
  /** How far back a payment date may be entered. */
  backdateDays: 366,
} as const;

export interface SubscriptionPaymentSummary {
  /** Fee for this subscription (plan price snapshot), in paise. */
  payablePaise: number;
  paidPaise: number;
  duePaise: number;
  status: SubscriptionPaymentStatus;
}

/** The single paid/due/status rule. All amounts are integer paise. */
export function paymentSummary(payablePaise: number, paidPaise: number): SubscriptionPaymentSummary {
  const duePaise = Math.max(0, payablePaise - paidPaise);
  const status =
    duePaise === 0 ? SubscriptionPaymentStatus.PAID : paidPaise > 0 ? SubscriptionPaymentStatus.PARTIAL : SubscriptionPaymentStatus.UNPAID;
  return { payablePaise, paidPaise, duePaise, status };
}

export interface RecordPaymentRequest {
  studentId: string;
  subscriptionId: string;
  amountPaise: number;
  method: PaymentMethod;
  /** YYYY-MM-DD; defaults to today. */
  paymentDate?: string;
  referenceNumber?: string;
  note?: string;
  /** Same key on a retried submit returns the first payment instead of recording twice. */
  idempotencyKey?: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  amountPaise: number;
  method: PaymentMethod;
  paymentDate: string;
  referenceNumber: string | null;
  note: string | null;
  status: PaymentTransactionStatus;
  student: { id: string; firstName: string; lastName: string | null; mobile: string };
  subscription: { id: string; planName: string; startDate: string; endDate: string };
  /** Balance left on the subscription right after this payment was recorded. */
  balanceAfterPaise: number;
  recordedBy: string | null;
  recordedAt: string;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
}

export interface PaymentReceipt extends PaymentRecord {
  mess: { name: string; mobile: string; address: string; city: string };
  /** Current due on the subscription (after any later payments/reversals). */
  currentDuePaise: number;
  generatedAt: string;
}

export interface PaymentListQuery extends PaginationQuery {
  from?: string;
  to?: string;
  method?: PaymentMethod;
  status?: PaymentTransactionStatus;
  studentId?: string;
  subscriptionId?: string;
  search?: string;
  sortBy?: 'paymentDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

export interface DueItem {
  subscriptionId: string;
  student: { id: string; firstName: string; lastName: string | null; mobile: string };
  planName: string;
  startDate: string;
  endDate: string;
  subscriptionStatus: SubscriptionStatus;
  payment: SubscriptionPaymentSummary;
}

export interface DuesQuery extends PaginationQuery {
  search?: string;
  /** Subscription timing filter. */
  subscriptionStatus?: Exclude<SubscriptionStatus, 'CANCELLED'>;
  studentId?: string;
}

export interface MonthlyPaymentStatus {
  /** YYYY-MM */
  month: string;
  counts: Record<SubscriptionPaymentStatus, number>;
  expectedPaise: number;
  collectedPaise: number;
  pendingPaise: number;
}

export interface MonthlyStatusQuery extends PaginationQuery {
  month: string;
  paymentStatus?: SubscriptionPaymentStatus;
  search?: string;
}

export interface PaymentDashboardSummary {
  collectedTodayPaise: number;
  collectedThisMonthPaise: number;
  pendingDuesPaise: number;
  studentsWithDues: number;
}

export type StudentFeesResponse =
  | { linked: false }
  | { linked: true; messName: string; totalDuePaise: number; subscriptions: import('./meal-plans').SubscriptionSummary[] };

// ── Money helpers (integer paise only) ──

const rupeeGrouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 200000 → "₹2,000"; 150050 → "₹1,500.50". Integer maths only. */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  return `${sign}₹${rupeeGrouping.format(rupees)}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

/** "1500", "1,500.5", "₹1500.50" → 150050; anything else → null. Parses as text, never as a float. */
export function parseRupeesToPaise(input: string): number | null {
  const clean = input.replace(/[₹,\s]/g, '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 150050 → "1500.50" for pre-filling inputs. */
export function paiseToInput(paise: number): string {
  const fraction = paise % 100;
  return `${Math.floor(paise / 100)}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}
