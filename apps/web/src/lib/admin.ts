import type { MessStatus, UserStatus } from '@mess/shared';

export const MESS_STATUS_UI: Record<MessStatus, { label: string; tone: 'success' | 'danger' }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

export const USER_STATUS_UI: Record<UserStatus, { label: string; tone: 'success' | 'danger' }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  DISABLED: { label: 'Suspended', tone: 'danger' },
};
