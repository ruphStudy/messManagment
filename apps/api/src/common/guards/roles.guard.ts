import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, ErrorCode, Permission, Role } from '@mess/shared';
import { PERMISSIONS_KEY, REQUIRE_MESS_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { AuthContextService } from '../../modules/auth/auth-context.service';
import { BillingService } from '../../modules/billing/billing.service';
import { AppException } from '../http/app.exception';
import type { AuthedRequest } from '../auth.types';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** A suspended mess is read-only: records stay viewable, nothing can be changed (one rule for team and students). */
export function messSuspended() {
  return AppException.forbidden('This mess is temporarily unavailable. Records can be viewed but no changes can be made. Please contact support.', ErrorCode.MESS_SUSPENDED);
}

/** Global guard enforcing @Roles, @RequirePermissions and @RequireMess metadata, plus the suspended-mess rule. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authContext: AuthContextService,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);
    const requireMess = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_MESS_KEY, targets);
    if (!roles && !permissions && !requireMess) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = req.auth;
    if (!auth) throw AppException.unauthorized();
    const isWrite = !READ_METHODS.has(req.method);

    if (roles && !roles.includes(auth.role)) throw AppException.forbidden();
    if (permissions && !permissions.every((p) => can(auth.role, p))) throw AppException.forbidden();
    if (requireMess) {
      if (!auth.membership) throw AppException.forbidden('Set up your mess first', ErrorCode.MESS_REQUIRED);
      if (auth.membership.mess.status !== 'ACTIVE' && isWrite) throw messSuspended();
      // MessMate (SaaS) access: reads, auth, account, billing view and student self-service stay open.
      if (isWrite && !(await this.billing.accessAllowed(auth.membership.messId))) {
        throw AppException.forbidden('Your MessMate subscription is not active. Records can be viewed; contact support to activate or renew.', ErrorCode.PLATFORM_SUBSCRIPTION_REQUIRED);
      }
    }
    // Student self-service writes (pauses, feedback, complaints, uploads, profile) belong to the student's mess.
    if (isWrite && auth.role === Role.STUDENT && roles?.includes(Role.STUDENT) && (await this.authContext.studentMessSuspended(auth.user.id))) {
      throw messSuspended();
    }
    return true;
  }
}
