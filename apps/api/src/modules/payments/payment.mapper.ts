import type { Mess, MessStudent, Payment, StudentSubscription, User } from '@prisma/client';
import type { PaymentReceipt, PaymentRecord } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

const personName = (u: Pick<User, 'firstName' | 'lastName'> | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null;

export const paymentInclude = {
  student: { select: { id: true, firstName: true, lastName: true, mobile: true } },
  subscription: { select: { id: true, planName: true, startDate: true, endDate: true, planPricePaise: true, amountPaidPaise: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
  reversedBy: { select: { firstName: true, lastName: true } },
} as const;

type Row = Payment & {
  student: Pick<MessStudent, 'id' | 'firstName' | 'lastName' | 'mobile'>;
  subscription: Pick<StudentSubscription, 'id' | 'planName' | 'startDate' | 'endDate' | 'planPricePaise' | 'amountPaidPaise'>;
  recordedBy: Pick<User, 'firstName' | 'lastName'> | null;
  reversedBy: Pick<User, 'firstName' | 'lastName'> | null;
};

export function toPaymentRecord(row: Row): PaymentRecord {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    amountPaise: row.amountPaise,
    method: row.method,
    paymentDate: toDateString(row.paymentDate),
    referenceNumber: row.referenceNumber,
    note: row.note,
    status: row.status,
    student: row.student,
    subscription: {
      id: row.subscription.id,
      planName: row.subscription.planName,
      startDate: toDateString(row.subscription.startDate),
      endDate: toDateString(row.subscription.endDate),
    },
    balanceAfterPaise: row.balanceAfterPaise,
    recordedBy: personName(row.recordedBy),
    recordedAt: row.createdAt.toISOString(),
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversedBy: personName(row.reversedBy),
    reversalReason: row.reversalReason,
  };
}

export function toPaymentReceipt(row: Row & { mess: Pick<Mess, 'name' | 'mobile' | 'address' | 'city'> }): PaymentReceipt {
  return {
    ...toPaymentRecord(row),
    mess: row.mess,
    currentDuePaise: row.subscription.planPricePaise - row.subscription.amountPaidPaise,
    generatedAt: new Date().toISOString(),
  };
}
