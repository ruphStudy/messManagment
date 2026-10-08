import type { Prisma } from '@prisma/client';
import { normalizeMobile } from '@mess/shared';

type TextField = 'firstName' | 'lastName' | 'email' | 'collegeName' | 'hostelOrPg';

/**
 * Word-by-word student search: every word must match one of the text fields or the mobile number
 * (so "raj 98765" narrows results). Used wherever lists are searchable by student.
 */
export function studentSearchTerms(search: string | undefined, fields: TextField[] = ['firstName', 'lastName']): Prisma.MessStudentWhereInput[] {
  if (!search) return [];
  return search
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((term) => {
      const contains = { contains: term, mode: 'insensitive' as const };
      const digits = normalizeMobile(term) ?? term.replace(/\D/g, '');
      return {
        OR: [...fields.map((f) => ({ [f]: contains })), ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : [])],
      };
    });
}
