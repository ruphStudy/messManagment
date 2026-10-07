import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, ErrorCode, Permission, Role } from '@mess/shared';
import { PERMISSIONS_KEY, REQUIRE_MESS_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { AppException } from '../http/app.exception';
import type { AuthedRequest } from '../auth.types';

/** Global guard enforcing @Roles, @RequirePermissions and @RequireMess metadata. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);
    const requireMess = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_MESS_KEY, targets);
    if (!roles && !permissions && !requireMess) return true;

    const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw AppException.unauthorized();

    if (roles && !roles.includes(auth.role)) throw AppException.forbidden();
    if (permissions && !permissions.every((p) => can(auth.role, p))) throw AppException.forbidden();
    if (requireMess) {
      if (!auth.membership) throw AppException.forbidden('Set up your mess first', ErrorCode.MESS_REQUIRED);
      if (auth.membership.mess.status !== 'ACTIVE') throw AppException.forbidden('This mess is currently suspended');
    }
    return true;
  }
}
