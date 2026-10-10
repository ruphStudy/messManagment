import type { AuthContext } from './api';
import type { MessStatus } from './enums';
import { Role } from './roles';

/**
 * What a signed-in session can do, independent of the device. Both clients route on this; the API still
 * enforces every permission. Order (first match wins):
 * disabled → password change → platform admin → mess team → linked student → unlinked student → no context.
 * MVP: one active team membership / the API's chosen student record (deterministic server-side); a future
 * context switcher would pick among several.
 */
export type SessionMode = 'BLOCKED' | 'PASSWORD_CHANGE' | 'ADMIN' | 'TEAM' | 'STUDENT' | 'UNLINKED' | 'NO_CONTEXT';

export interface ResolvedSession {
  mode: SessionMode;
  role: Role;
  messId: string | null;
  messName: string | null;
  messStatus: MessStatus | null;
  mustChangePassword: boolean;
}

export function resolveSession(session: AuthContext): ResolvedSession {
  const team = session.membership;
  const student = session.student?.linked ? session.student.mess : null;
  const mess = team?.mess ?? student ?? null;
  const base = {
    role: session.role,
    messId: mess?.id ?? null,
    messName: mess?.name ?? null,
    messStatus: mess?.status ?? null,
    mustChangePassword: session.user.mustChangePassword,
  };
  const mode: SessionMode =
    session.user.status !== 'ACTIVE'
      ? 'BLOCKED'
      : session.user.mustChangePassword
        ? 'PASSWORD_CHANGE'
        : session.role === Role.PLATFORM_ADMIN
          ? 'ADMIN'
          : team
            ? 'TEAM'
            : session.role === Role.STUDENT
              ? student
                ? 'STUDENT'
                : 'UNLINKED'
              : 'NO_CONTEXT';
  return { mode, ...base };
}
