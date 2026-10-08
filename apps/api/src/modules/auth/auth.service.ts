import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { AuditAction, AuditTargetType, AuthContext, AuthResponse, ErrorCode, isEmailIdentifier, normalizeMobile, Role, WEB_ROLES } from '@mess/shared';
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
import { ChangePasswordDto, LoginDto, PasswordResetConfirmDto, RegisterOwnerDto, UpdateAccountDto } from './dto/auth.dto';
import type { RequestAuth } from '../../common/auth.types';

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

  // ── Own account (team accounts and platform admin) ──

  async updateAccount(auth: RequestAuth, dto: UpdateAccountDto): Promise<AuthContext> {
    this.assertPasswordAccount(auth.user);
    if (dto.email && dto.email !== auth.user.email) {
      const taken = await this.prisma.user.count({ where: { email: dto.email, id: { not: auth.user.id } } });
      if (taken) throw AppException.conflict('This email is already used by another account', { email: ['Already in use'] });
    }
    const user = await this.prisma.user.update({
      where: { id: auth.user.id },
      data: { firstName: dto.firstName, lastName: dto.lastName, email: dto.email, ...(dto.email !== undefined && dto.email !== auth.user.email ? { emailVerified: false } : {}) },
    });
    return toAuthContext({ ...auth, user });
  }

  /** Verifies the current password, stores the new one and signs out every other session. */
  async changePassword(auth: RequestAuth, dto: ChangePasswordDto): Promise<AuthContext> {
    this.assertPasswordAccount(auth.user);
    if (!auth.user.passwordHash || !(await verifyPassword(dto.currentPassword, auth.user.passwordHash))) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.PASSWORD_INCORRECT, 'Your current password is incorrect', { currentPassword: ['Incorrect password'] });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw AppException.validation({ newPassword: ['Choose a password different from the current one'] });
    }
    const user = await this.prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash: await hashPassword(dto.newPassword), mustChangePassword: false },
    });
    await this.sessions.revokeAllForUser(user.id, auth.sessionId);
    return toAuthContext({ ...auth, user });
  }

  /** Forgot password: OTP to a team account's mobile. Same answer whether or not the number is registered. */
  async requestPasswordReset(mobile: string) {
    const user = await this.prisma.user.findUnique({ where: { mobile } });
    if (!user || !PASSWORD_LOGIN_ROLES.includes(user.role) || user.status !== 'ACTIVE') {
      return { expiresIn: this.config.otpTtlSeconds, resendIn: this.config.otpResendSeconds };
    }
    return this.otp.issue(mobile);
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    const user = await this.prisma.user.findUnique({ where: { mobile: dto.mobile } });
    if (!user || !PASSWORD_LOGIN_ROLES.includes(user.role)) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.OTP_EXPIRED, 'This code has expired. Request a new one.');
    }
    await this.otp.verify(dto.mobile, dto.code);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(dto.newPassword), mustChangePassword: false, mobileVerified: true } });
    await this.sessions.revokeAllForUser(user.id);
  }

  private assertPasswordAccount(user: User) {
    if (!PASSWORD_LOGIN_ROLES.includes(user.role)) throw AppException.forbidden('Use the student app to manage your profile', ErrorCode.WRONG_APP);
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
