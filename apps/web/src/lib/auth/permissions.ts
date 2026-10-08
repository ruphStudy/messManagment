import { Role, WEB_ROLES, type AuthContext } from '@mess/shared';

/** Where a signed-in user should land in the web app. */
export function homePath(session: AuthContext): string {
  if (session.role === Role.PLATFORM_ADMIN) return '/admin';
  if (!WEB_ROLES.includes(session.role)) return '/no-access';
  if (!session.membership) return session.role === Role.MESS_OWNER ? '/onboarding' : '/no-access';
  return '/dashboard';
}

