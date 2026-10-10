import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@mess/shared';
import { AuthContextService } from '../../modules/auth/auth-context.service';
import { ALLOW_PENDING_PASSWORD_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { AppException } from '../http/app.exception';
import type { AccessTokenPayload, AuthedRequest } from '../auth.types';

/** Global guard: verifies the bearer access token and loads the live session, user and membership. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw AppException.unauthorized();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw AppException.unauthorized('Your session has expired', ErrorCode.SESSION_EXPIRED);
    }

    req.auth = await this.authContext.loadForSession(payload.sid, payload.sub);

    // Temporary password: only the password-change flow is usable until it is replaced (enforced here, not just in the UI).
    if (req.auth.user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, [context.getHandler(), context.getClass()]);
      if (!allowed) throw AppException.forbidden('Please set a new password to continue', ErrorCode.PASSWORD_CHANGE_REQUIRED);
    }
    return true;
  }
}
