import type { PaginationQuery } from './api';
import type { PaymentMethod } from './payments';

export const ExpenseStatus = { RECORDED: 'RECORDED', REVERSED: 'REVERSED' } as const;
export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus];

/** Created for every mess on first use; owners can add more. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Groceries',
  'Vegetables',
  'Dairy',
  'Gas',
  'Electricity',
  'Rent',
  'Salary',
  'Cleaning',
  'Repair',
  'Transport',
  'Packaging',
  'Other',
] as const;

export const EXPENSE_LIMITS = {
  titleMax: 80,
  categoryNameMax: 40,
  vendorMax: 80,
  referenceMax: 60,
  noteMax: 200,
  /** ₹10,00,000 per entry. */
  amountMaxPaise: 100_000_000,
  rangeDays: 366,
} as const;

export interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
  /** Recorded (non-reversed) expenses using this category. */
  expenseCount: number;
}

export interface ExpenseInput {
  categoryId: string;
  title: string;
  amountPaise: number;
  /** YYYY-MM-DD, today or earlier. */
  expenseDate: string;
  paymentMethod?: PaymentMethod | null;
  vendorName?: string | null;
  referenceNumber?: string | null;
  note?: string | null;
}

export interface Expense {
  id: string;
  category: { id: string; name: string };
  title: string;
  amountPaise: number;
  expenseDate: string;
  paymentMethod: PaymentMethod | null;
  vendorName: string | null;
  referenceNumber: string | null;
  note: string | null;
  status: ExpenseStatus;
  recordedBy: string | null;
  recordedAt: string;
  updatedAt: string;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
}

export interface ExpenseListQuery extends PaginationQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  status?: ExpenseStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
  sortBy?: 'expenseDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

/** Totals of RECORDED expenses only (reversed ones never count). */
export interface ExpenseSummary {
  from: string;
  to: string;
  totalPaise: number;
  count: number;
  categories: { categoryId: string; name: string; totalPaise: number; count: number }[];
  daily: { date: string; totalPaise: number }[];
}

/**
 * Basic operating estimate for a month — not accounting profit.
 * Revenue = recorded (non-reversed) student payments dated in the month. Unpaid dues are NOT revenue.
 */
export interface FinanceMonthlySummary {
  month: string;
  collectedPaise: number;
  expensesPaise: number;
  /** collected − expenses */
  netPaise: number;
  /** Shown separately for context: money still owed right now, never added to revenue. */
  pendingDuesPaise: number;
}
