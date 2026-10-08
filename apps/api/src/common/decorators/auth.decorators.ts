import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ErrorCode, OWNER_OR_MANAGER, MESS_TEAM_ROLES, Permission, Role } from '@mess/shared';
import { AppException } from '../http/app.exception';
import type { AuthedRequest, RequestAuth } from '../auth.types';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const PERMISSIONS_KEY = 'auth:permissions';
export const REQUIRE_MESS_KEY = 'auth:requireMess';

/** Skips authentication for the route. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Allows only the given effective roles. */
export const Roles = (...roles: Role[]) => applyDecorators(SetMetadata(ROLES_KEY, roles), ApiBearerAuth());

/** Requires all of the given permissions (see ROLE_PERMISSIONS in @mess/shared). */
export const RequirePermissions = (...permissions: Permission[]) =>
  applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions), ApiBearerAuth());

/** Requires an active membership in an active mess. Use with @CurrentMessId() for tenant scoping. */
export const RequireMess = () => applyDecorators(SetMetadata(REQUIRE_MESS_KEY, true), ApiBearerAuth());

export const PlatformAdminOnly = () => Roles(Role.PLATFORM_ADMIN);
/** Platform admin portal routes: admin role AND the explicit admin permission. No mess membership involved. */
export const AdminOnly = () => applyDecorators(Roles(Role.PLATFORM_ADMIN), RequirePermissions(Permission.PLATFORM_ADMIN_ACCESS));
export const OwnerOnly = () => Roles(Role.MESS_OWNER);
export const OwnerOrManager = () => Roles(...OWNER_OR_MANAGER);
export const MessTeam = () => Roles(...MESS_TEAM_ROLES);
export const StudentOnly = () => Roles(Role.STUDENT);

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestAuth => {
  const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
  if (!auth) throw AppException.unauthorized();
  return auth;
});

/**
 * The mess the caller works in, taken from their server-side membership — never from client input.
 * Every tenant-owned query must filter by this id.
 */
export const CurrentMessId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const membership = ctx.switchToHttp().getRequest<AuthedRequest>().auth?.membership;
  if (!membership) throw AppException.forbidden('Set up your mess first', ErrorCode.MESS_REQUIRED);
  return membership.messId;
});
