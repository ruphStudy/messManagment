import type { MembershipStatus, MessStatus, Role, User } from '@prisma/client';
import type { Request } from 'express';

export interface ActiveMembership {
  id: string;
  messId: string;
  role: Role;
  status: MembershipStatus;
  mess: { id: string; name: string; status: MessStatus };
}

/** Authenticated principal attached to the request by JwtAuthGuard. */
export interface RequestAuth {
  user: User;
  sessionId: string;
  membership: ActiveMembership | null;
  /** Effective role: membership role when working inside a mess, otherwise the account role. */
  role: Role;
}

export interface AuthedRequest extends Request {
  auth?: RequestAuth;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}
