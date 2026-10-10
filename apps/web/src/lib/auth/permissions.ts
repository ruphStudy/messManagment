import { resolveSession, Role, type AuthContext } from '@mess/shared';

/** Where a signed-in user lands on the web — from the shared session resolver, never from the login form used. */
export function homePath(session: AuthContext): string {
  const ctx = resolveSession(session);
  switch (ctx.mode) {
    case 'PASSWORD_CHANGE':
      return '/settings?tab=account';
    case 'ADMIN':
      return '/admin';
    case 'TEAM':
      return '/dashboard';
    case 'STUDENT':
    case 'UNLINKED':
      return '/student';
    case 'NO_CONTEXT':
      // An owner without a mess yet sets one up; team accounts without a membership have no access.
      return ctx.role === Role.MESS_OWNER ? '/onboarding' : '/no-access';
    default:
      return '/no-access';
  }
}
