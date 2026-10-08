import { Inject, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { AuditAction, AuditTargetType, AuthResponse, ErrorCode, isEmailIdentifier, normalizeMobile, Role, WEB_ROLES } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { toAuthContext, toAuthUser } from '../users/user.mapper';
import { AuthContextService } from './auth-context.service';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './crypto.util';
import { StudentLinkService } from '../students/student-link.service';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';
import { IssuedSession, SessionMeta, SessionService } from './session.service';
import { LoginDto, RegisterOwnerDto } from './dto/auth.dto';

const PASSWORD_LOGIN_ROLES: readonly Role[] = [...WEB_ROLES, Role.PLATFORM_ADMIN];

export interface AuthResult {
  response: AuthResponse;
  session: IssuedSession;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly authContext: AuthContextService,
    private readonly otp: OtpService,
    private readonly studentLinker: StudentLinkService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async registerOwner(dto: RegisterOwnerDto) {
    const existing = await this.prisma.user.findMany({
      where: { OR: [{ mobile: dto.mobile }, { email: dto.email }] },
      select: { mobile: true, email: true },
    });
    const fields: Record<string, string[]> = {};
    if (existing.some((u) => u.mobile === dto.mobile)) fields.mobile = ['This mobile number is already registered'];
    if (existing.some((u) => u.email === dto.email)) fields.email = ['This email is already registered'];
    if (Object.keys(fields).length) throw AppException.conflict('An account already exists with these details', fields);

    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          mobile: dto.mobile,
          email: dto.email,
          passwordHash: await hashPassword(dto.password),
          role: Role.MESS_OWNER,
        },
      });
      return { user: toAuthUser(user) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppException.conflict('An account already exists with these details');
      }
      throw error;
    }
  }

  /** Password login for owners, managers and staff (web). */
  async login(dto: LoginDto, meta: Omit<SessionMeta, 'persistent'>): Promise<AuthResult> {
    const identifier = isEmailIdentifier(dto.identifier)
      ? { email: dto.identifier.toLowerCase() }
      : { mobile: normalizeMobile(dto.identifier) ?? dto.identifier };
    const user = await this.prisma.user.findUnique({ where: identifier });

    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await DUMMY_PASSWORD_HASH));
    if (!user || !user.passwordHash || !valid) {
      throw AppException.unauthorized('Incorrect mobile/email or password', ErrorCode.INVALID_CREDENTIALS);
    }
    this.authContext.assertActive(user);
    if (!PASSWORD_LOGIN_ROLES.includes(user.role)) {
      throw AppException.forbidden('Students sign in with the mobile app using their phone number', ErrorCode.WRONG_APP);
    }

    const auth = await this.authContext.build(user, '');
    const isTeamMember = user.role === Role.MESS_MANAGER || user.role === Role.MESS_STAFF;
    if (isTeamMember && !auth.membership) {
      throw AppException.forbidden('Your mess access has been removed. Contact your mess owner.', ErrorCode.ACCOUNT_DISABLED);
    }

    const result = await this.startSession(user, { ...meta, persistent: dto.rememberMe ?? false });
    if (user.role === Role.PLATFORM_ADMIN) {
      await this.audit.record({ actorUserId: user.id, action: AuditAction.ADMIN_LOGIN, targetType: AuditTargetType.USER, targetId: user.id, label: [user.firstName, user.lastName].filter(Boolean).join(' ') });
    }
    return result;
  }

  async requestStudentOtp(mobile: string) {
    const user = await this.prisma.user.findUnique({ where: { mobile } });
    if (user) this.assertStudentAccount(user);
    return this.otp.issue(mobile);
  }

  /** Verifies the OTP and signs the student in, creating a minimal account on first login. */
  async verifyStudentOtp(mobile: string, code: string, meta: Omit<SessionMeta, 'persistent'>): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { mobile } });
    if (existing) this.assertStudentAccount(existing);

    await this.otp.verify(mobile, code);

    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { mobileVerified: true } })
      : await this.prisma.user.create({ data: { firstName: '', mobile, role: Role.STUDENT, mobileVerified: true } });
    await this.studentLinker.linkUser(user);

    return this.startSession(user, { ...meta, persistent: true });
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw AppException.unauthorized('Your session has expired', ErrorCode.SESSION_EXPIRED);
    const { user, issued } = await this.sessions.rotate(refreshToken);
    const auth = await this.authContext.build(user, issued.sessionId);
    return { response: this.toResponse(toAuthContext(auth), issued), session: issued };
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await this.sessions.revokeByToken(refreshToken);
  }

  private async startSession(user: User, meta: SessionMeta): Promise<AuthResult> {
    const session = await this.sessions.create(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const auth = await this.authContext.build(user, session.sessionId);
    return { response: this.toResponse(toAuthContext(auth), session), session };
  }

  private toResponse(context: ReturnType<typeof toAuthContext>, session: IssuedSession): AuthResponse {
    return {
      ...context,
      accessToken: session.accessToken,
      accessTokenExpiresIn: this.config.jwtAccessTtlSeconds,
    };
  }

  private assertStudentAccount(user: User) {
    this.authContext.assertActive(user);
    if (user.role !== Role.STUDENT) {
      throw AppException.forbidden('This number belongs to a mess team account. Please use the web app.', ErrorCode.WRONG_APP);
    }
  }
}
