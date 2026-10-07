import type { PaginationQuery } from './api';

export const StudentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
};

/** Statuses an admin can switch between directly; archiving has its own action. */
export const TOGGLEABLE_STUDENT_STATUSES = [StudentStatus.ACTIVE, StudentStatus.INACTIVE] as const;
export type ToggleableStudentStatus = (typeof TOGGLEABLE_STUDENT_STATUSES)[number];

export const STUDENT_SORT_FIELDS = ['createdAt', 'name', 'joiningDate'] as const;
export type StudentSortField = (typeof STUDENT_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

export interface StudentListQuery extends PaginationQuery {
  search?: string;
  /** Omit to list active + inactive (archived are hidden by default). */
  status?: StudentStatus;
  sortBy?: StudentSortField;
  sortOrder?: SortOrder;
}

/** Fields an owner/manager can set. Never includes messId, userId or status. */
export interface StudentInput {
  firstName: string;
  lastName: string | null;
  mobile: string;
  email: string | null;
  collegeName: string | null;
  courseName: string | null;
  hostelOrPg: string | null;
  localAddress: string | null;
  parentName: string | null;
  parentMobile: string | null;
  emergencyContactName: string | null;
  emergencyContactMobile: string | null;
  /** YYYY-MM-DD */
  joiningDate: string;
  notes: string | null;
}

export interface StudentListItem {
  id: string;
  firstName: string;
  lastName: string | null;
  mobile: string;
  collegeName: string | null;
  hostelOrPg: string | null;
  joiningDate: string;
  status: StudentStatus;
  appLinked: boolean;
}

export interface StudentAppAccount {
  linked: boolean;
  lastLoginAt: string | null;
}

export interface StudentDetail extends StudentInput {
  id: string;
  status: StudentStatus;
  appAccount: StudentAppAccount;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields a student may change on their own profile. */
export const STUDENT_SELF_EDITABLE = ['email', 'collegeName', 'courseName', 'hostelOrPg', 'localAddress'] as const;
export type StudentSelfUpdate = Pick<StudentInput, (typeof STUDENT_SELF_EDITABLE)[number]>;

export interface StudentSelfProfile extends Omit<StudentInput, 'notes'> {
  id: string;
  status: StudentStatus;
  mess: { id: string; name: string; mobile: string; city: string };
}

export type StudentMeResponse = { linked: false } | { linked: true; profile: StudentSelfProfile };

export const STUDENT_IMPORT_LIMITS = { maxBytes: 1024 * 1024, maxRows: 500 } as const;

/** CSV columns in template order. Only firstName and mobile are required; a blank joiningDate means the import date. */
export const STUDENT_CSV_COLUMNS = [
  'firstName',
  'lastName',
  'mobile',
  'email',
  'collegeName',
  'courseName',
  'hostelOrPg',
  'joiningDate',
  'parentName',
  'parentMobile',
  'emergencyContactName',
  'emergencyContactMobile',
  'localAddress',
] as const;
export type StudentCsvColumn = (typeof STUDENT_CSV_COLUMNS)[number];
export const STUDENT_CSV_REQUIRED: readonly StudentCsvColumn[] = ['firstName', 'mobile'];

export interface StudentImportIssue {
  /** Spreadsheet row number (the header is row 1). */
  row: number;
  field?: string;
  message: string;
  kind: 'skipped' | 'failed';
}

export interface StudentImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  issues: StudentImportIssue[];
}
