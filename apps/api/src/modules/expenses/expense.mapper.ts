import type { Expense as Row, ExpenseCategory, User } from '@prisma/client';
import type { Expense } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

const personName = (u: Pick<User, 'firstName' | 'lastName'> | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null;

export const expenseInclude = {
  category: { select: { id: true, name: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
  reversedBy: { select: { firstName: true, lastName: true } },
} as const;

export function toExpense(
  row: Row & {
    category: Pick<ExpenseCategory, 'id' | 'name'>;
    recordedBy: Pick<User, 'firstName' | 'lastName'> | null;
    reversedBy: Pick<User, 'firstName' | 'lastName'> | null;
  },
): Expense {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    amountPaise: row.amountPaise,
    expenseDate: toDateString(row.expenseDate),
    paymentMethod: row.paymentMethod,
    vendorName: row.vendorName,
    referenceNumber: row.referenceNumber,
    note: row.note,
    status: row.status,
    recordedBy: personName(row.recordedBy),
    recordedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversedBy: personName(row.reversedBy),
    reversalReason: row.reversalReason,
  };
}
