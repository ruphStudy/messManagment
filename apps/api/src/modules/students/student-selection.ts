import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@mess/shared';
import { AppException } from '../../common/http/app.exception';

interface Candidate {
  messId: string;
  status: string;
  mess: { status: string };
}

/**
 * The single rule for "which of my student records does this request use" (student multi-mess).
 * - x-mess-id given → that mess's record, if this user has one (else STUDENT_MESS_NOT_AVAILABLE — guessed ids get nothing).
 * - none given → the only usable record (ACTIVE student in an ACTIVE mess); several usable → STUDENT_MESS_SELECTION_REQUIRED;
 *   none usable → the first record (inactive / suspended: read-only history), as before.
 * `records` are the user's non-archived records, active first then most recent joining.
 */
export function pickStudentRecord<T extends Candidate>(records: T[], selected: string | null): T | null {
  if (selected) {
    const match = records.find((r) => r.messId === selected);
    if (!match) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.STUDENT_MESS_NOT_AVAILABLE, 'You are not a student of this mess. Choose another mess.');
    return match;
  }
  const usable = records.filter((r) => r.status === 'ACTIVE' && r.mess.status === 'ACTIVE');
  if (usable.length === 1) return usable[0];
  if (usable.length > 1) throw new AppException(HttpStatus.CONFLICT, ErrorCode.STUDENT_MESS_SELECTION_REQUIRED, 'You are a student in more than one mess. Choose which mess to use.');
  return records[0] ?? null;
}
