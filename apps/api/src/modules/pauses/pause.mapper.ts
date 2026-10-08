import type { MealPause, MessStudent, User } from '@prisma/client';
import { PauseStatus, type PauseRecord, type StudentPauseItem } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

const personName = (u: Pick<User, 'firstName' | 'lastName'> | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null;

export const pauseInclude = {
  student: { select: { id: true, firstName: true, lastName: true, mobile: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  cancelledBy: { select: { firstName: true, lastName: true } },
} as const;

type Row = MealPause & {
  student: Pick<MessStudent, 'id' | 'firstName' | 'lastName' | 'mobile'>;
  createdBy: Pick<User, 'firstName' | 'lastName'> | null;
  cancelledBy: Pick<User, 'firstName' | 'lastName'> | null;
};

export function toStudentPauseItem(row: MealPause, today: string): StudentPauseItem {
  const date = toDateString(row.pauseDate);
  return {
    id: row.id,
    date,
    mealType: row.mealType,
    status: row.status,
    source: row.source,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    // Paused meals can't be served, so an active pause for today or later can always be resumed.
    canCancel: row.status === PauseStatus.ACTIVE && date >= today,
  };
}

export function toPauseRecord(row: Row, today: string): PauseRecord {
  return {
    ...toStudentPauseItem(row, today),
    student: row.student,
    createdBy: personName(row.createdBy),
    cancelledBy: personName(row.cancelledBy),
  };
}
