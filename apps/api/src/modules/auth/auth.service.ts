import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { AuditAction, AuditTargetType, AuthContext, AuthResponse, ErrorCode, isEmailIdentifier, normalizeMobile, Role, WEB_ROLES } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { toAuthContext, toAuthUser } from '../users/user.mapper';
import { BillingService } from '../billing/billing.service';
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
    private readonly billing: BillingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async registerOwner(dto: RegisterOwnerDto) {
    const existing = await this.prisma.user.findMany({
      where: { OR: [{ mobile: dto.mobile }, { email: dto.email }] },
      select: { mobile: true, email: true },
    });
    // Never a second account (or a role change) for a known number/email: the person signs in instead.
    // The message doesn't say what kind of account it is.
    const fields: Record<string, string[]> = {};
    if (existing.some((u) => u.mobile === dto.mobile)) fields.mobile = ['Already registered — please sign in'];
    if (existing.some((u) => u.email === dto.email)) fields.email = ['Already registered — please sign in'];
    if (Object.keys(fields).length) throw this.accountExists(fields);

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
        throw this.accountExists();
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
      throw AppException.forbidden('Student accounts sign in with a one-time code sent to your mobile', ErrorCode.OTP_SIGN_IN_REQUIRED);
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
    return { response: this.toResponse(await this.describe(toAuthContext(auth)), issued), session: issued };
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
    if (!PASSWORD_LOGIN_ROLES.includes(user.role)) throw AppException.forbidden('Student accounts manage their profile from the student profile page', ErrorCode.OTP_SIGN_IN_REQUIRED);
  }

  private accountExists(fields?: Record<string, string[]>) {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.ACCOUNT_EXISTS, 'An account already exists for this mobile number or email. Please sign in.', fields);
  }

  /**
   * Session context for clients to route on (any role, any device): identity, membership, and for students
   * every mess they are linked to (a student may be in several); the client selects one (x-mess-id).
   */
  async describe(context: AuthContext): Promise<AuthContext> {
    if (context.role !== Role.STUDENT) {
      // Team: MessMate access, so apps can show "subscription required" up front (the API enforces it anyway).
      const billing = context.membership ? await this.billing.summary(context.membership.mess.id) : null;
      return { ...context, student: null, billing: billing && { status: billing.status, accessAllowed: billing.accessAllowed, accessUntil: billing.accessUntil } };
    }
    // Link any record the mess created for this verified mobile since the last check (sign-in, refresh,
    // /auth/me, "Check again"). Only unlinked rows with the exact normalized mobile; never reassigns a userId.
    await this.studentLinker.linkUser({ id: context.user.id, mobile: context.user.mobile, role: context.user.role });
    const records = await this.prisma.messStudent.findMany({
      where: { userId: context.user.id, status: { not: 'ARCHIVED' } },
      orderBy: [{ status: 'asc' }, { joiningDate: 'desc' }],
      select: { id: true, status: true, mess: { select: { id: true, name: true, status: true } } },
    });
    const memberships = records
      .map((r) => ({ studentId: r.id, messId: r.mess.id, messName: r.mess.name, status: r.status, messStatus: r.mess.status, usable: r.status === 'ACTIVE' && r.mess.status === 'ACTIVE' }))
      .sort((a, b) => Number(b.usable) - Number(a.usable));
    const usable = memberships.filter((m) => m.usable);
    const fallback = usable.length === 1 ? usable[0] : usable.length === 0 && memberships.length === 1 ? memberships[0] : null;
    return {
      ...context,
      student: {
        linked: memberships.length > 0,
        memberships,
        defaultMessId: fallback?.messId ?? null,
        mess: fallback ? { id: fallback.messId, name: fallback.messName, status: fallback.messStatus } : null,
      },
    };
  }

  private async startSession(user: User, meta: SessionMeta): Promise<AuthResult> {
    const session = await this.sessions.create(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const auth = await this.authContext.build(user, session.sessionId);
    return { response: this.toResponse(await this.describe(toAuthContext(auth)), session), session };
  }

  private toResponse(context: AuthContext, session: IssuedSession): AuthResponse {
    return {
      ...context,
      accessToken: session.accessToken,
      accessTokenExpiresIn: this.config.jwtAccessTtlSeconds,
    };
  }

  private assertStudentAccount(user: User) {
    this.authContext.assertActive(user);
    // Password accounts (owner/team/admin) never become students through OTP signup; their role is untouched.
    if (user.role !== Role.STUDENT) {
      throw AppException.forbidden('This number already has an account that signs in with a password. Please sign in with your mobile number and password.', ErrorCode.PASSWORD_SIGN_IN_REQUIRED);
    }
  }
}
