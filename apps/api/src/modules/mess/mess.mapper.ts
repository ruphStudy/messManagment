import type { Mess } from '@prisma/client';
import type { MessProfile } from '@mess/shared';

export function toMessProfile(mess: Mess): MessProfile {
  const { ownerId: _ownerId, createdAt, updatedAt, ...rest } = mess;
  return { ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}
