import type { User } from '@prisma/client';
import type { AuthContext, AuthUser, MessRole } from '@mess/shared';
import type { RequestAuth } from '../../common/auth.types';

/** Public view of a user. Never includes passwordHash or session data. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
  };
}

export function toAuthContext(auth: RequestAuth): AuthContext {
  const { membership } = auth;
  return {
    user: toAuthUser(auth.user),
    role: auth.role,
    membership: membership
      ? {
          id: membership.id,
          role: membership.role as MessRole,
          status: membership.status,
          mess: { id: membership.mess.id, name: membership.mess.name },
        }
      : null,
  };
}
