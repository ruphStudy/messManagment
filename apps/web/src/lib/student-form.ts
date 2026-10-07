import {
  firstError,
  LIMITS,
  normalizeMobile,
  todayDateString,
  validators,
  type StudentDetail,
  type StudentInput,
} from '@mess/shared';
import type { FieldErrors } from './use-form';

/** Form state keeps every field as a string; empty optional fields are sent as null. */
export type StudentFormValues = { [K in keyof StudentInput]: string };

const OPTIONAL_FIELDS = [
  'lastName',
  'email',
  'collegeName',
  'courseName',
  'hostelOrPg',
  'localAddress',
  'parentName',
  'parentMobile',
  'emergencyContactName',
  'emergencyContactMobile',
  'notes',
] as const;

export function emptyStudentForm(): StudentFormValues {
  return {
    firstName: '',
    mobile: '',
    joiningDate: todayDateString(),
    ...(Object.fromEntries(OPTIONAL_FIELDS.map((k) => [k, ''])) as Record<(typeof OPTIONAL_FIELDS)[number], string>),
  };
}

export function studentToForm(student: StudentDetail): StudentFormValues {
  const values = emptyStudentForm();
  for (const key of Object.keys(values) as (keyof StudentFormValues)[]) values[key] = student[key] ?? '';
  return values;
}

export function validateStudent(v: StudentFormValues): FieldErrors<StudentFormValues> {
  const text = (max: number) => (value: string) => validators.maxLength(max)(value.trim());
  return {
    firstName: firstError(v.firstName, validators.required, text(LIMITS.nameMax)),
    lastName: text(LIMITS.nameMax)(v.lastName),
    mobile: firstError(v.mobile, validators.required, validators.mobile),
    email: validators.optionalEmail(v.email),
    collegeName: text(LIMITS.textMax)(v.collegeName),
    courseName: text(LIMITS.textMax)(v.courseName),
    hostelOrPg: text(LIMITS.textMax)(v.hostelOrPg),
    localAddress: text(LIMITS.addressMax)(v.localAddress),
    parentName: text(LIMITS.nameMax)(v.parentName),
    parentMobile: validators.optionalMobile(v.parentMobile),
    emergencyContactName: text(LIMITS.nameMax)(v.emergencyContactName),
    emergencyContactMobile: validators.optionalMobile(v.emergencyContactMobile),
    joiningDate: firstError(v.joiningDate, validators.required, validators.date),
    notes: text(LIMITS.notesMax)(v.notes),
  };
}

export function toStudentInput(v: StudentFormValues): StudentInput {
  const optional = (value: string) => value.trim() || null;
  const optionalMobile = (value: string) => (value.trim() ? (normalizeMobile(value) ?? value.trim()) : null);
  return {
    firstName: v.firstName.trim(),
    lastName: optional(v.lastName),
    mobile: normalizeMobile(v.mobile) ?? v.mobile.trim(),
    email: optional(v.email)?.toLowerCase() ?? null,
    collegeName: optional(v.collegeName),
    courseName: optional(v.courseName),
    hostelOrPg: optional(v.hostelOrPg),
    localAddress: optional(v.localAddress),
    parentName: optional(v.parentName),
    parentMobile: optionalMobile(v.parentMobile),
    emergencyContactName: optional(v.emergencyContactName),
    emergencyContactMobile: optionalMobile(v.emergencyContactMobile),
    joiningDate: v.joiningDate,
    notes: optional(v.notes),
  };
}
