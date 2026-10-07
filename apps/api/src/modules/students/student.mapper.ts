import type { Mess, MessStudent, User } from '@prisma/client';
import type { StudentDetail, StudentListItem, StudentSelfProfile } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

export const studentListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  mobile: true,
  collegeName: true,
  hostelOrPg: true,
  joiningDate: true,
  status: true,
  userId: true,
} as const;

type ListRow = Pick<MessStudent, keyof typeof studentListSelect>;

export function toStudentListItem({ userId, joiningDate, ...rest }: ListRow): StudentListItem {
  return { ...rest, joiningDate: toDateString(joiningDate), appLinked: !!userId };
}

/** Only exposes whether an app account is linked; never user ids or auth data. */
export function toStudentDetail(student: MessStudent & { user: Pick<User, 'lastLoginAt'> | null }): StudentDetail {
  const { messId: _messId, userId: _userId, user, joiningDate, archivedAt, createdAt, updatedAt, ...rest } = student;
  return {
    ...rest,
    joiningDate: toDateString(joiningDate),
    appAccount: { linked: !!user, lastLoginAt: user?.lastLoginAt?.toISOString() ?? null },
    archivedAt: archivedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toStudentSelfProfile(
  student: MessStudent & { mess: Pick<Mess, 'id' | 'name' | 'mobile' | 'city'> },
): StudentSelfProfile {
  const {
    messId: _messId,
    userId: _userId,
    notes: _notes,
    archivedAt: _archivedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    joiningDate,
    ...rest
  } = student;
  return { ...rest, joiningDate: toDateString(joiningDate) };
}
