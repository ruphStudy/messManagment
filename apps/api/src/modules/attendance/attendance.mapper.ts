import type { MealAttendance, MessStudent, StudentSubscription, User } from '@prisma/client';
import type { AttendanceRecord, StudentAttendanceItem } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

const personName = (u: Pick<User, 'firstName' | 'lastName'> | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : null);

export const attendanceInclude = {
  student: { select: { id: true, firstName: true, lastName: true, mobile: true } },
  subscription: { select: { planName: true, remainingMealCredits: true, totalMealCredits: true } },
  servedBy: { select: { firstName: true, lastName: true } },
  reversedBy: { select: { firstName: true, lastName: true } },
} as const;

type Row = MealAttendance & {
  student: Pick<MessStudent, 'id' | 'firstName' | 'lastName' | 'mobile'>;
  subscription: Pick<StudentSubscription, 'planName' | 'remainingMealCredits' | 'totalMealCredits'>;
  servedBy: Pick<User, 'firstName' | 'lastName'> | null;
  reversedBy: Pick<User, 'firstName' | 'lastName'> | null;
};

export function toAttendanceRecord(row: Row): AttendanceRecord {
  return {
    id: row.id,
    date: toDateString(row.attendanceDate),
    mealType: row.mealType,
    source: row.source,
    status: row.status,
    servedAt: row.createdAt.toISOString(),
    student: row.student,
    planName: row.subscription.planName,
    creditDeducted: row.creditDeducted,
    remainingMealCredits: row.subscription.remainingMealCredits,
    totalMealCredits: row.subscription.totalMealCredits,
    servedBy: personName(row.servedBy),
    note: row.note,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversedBy: personName(row.reversedBy),
    reversalReason: row.reversalReason,
  };
}

export function toStudentAttendanceItem(row: MealAttendance & { subscription: Pick<StudentSubscription, 'planName'> }): StudentAttendanceItem {
  return {
    id: row.id,
    date: toDateString(row.attendanceDate),
    mealType: row.mealType,
    status: row.status,
    servedAt: row.createdAt.toISOString(),
    planName: row.subscription.planName,
  };
}
