import type { Prisma } from '@prisma/client';

/**
 * Transaction-scoped lock per student. Subscription changes and meal attendance take the same lock,
 * so checks like "no overlapping plan" or "not already served / credits left" can't race each other.
 */
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
}
