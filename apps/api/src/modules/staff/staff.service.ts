import { HttpStatus, Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, Role, UserStatus } from '@prisma/client';
import {
  ErrorCode,
  normalizeMobile,
  STAFF_ASSIGNABLE_ROLES,
  staffActionsFor,
  TEAM_MANAGEABLE_ROLES,
  type CreateStaffResult,
  type StaffDetail,
  type StaffListItem,
  type StaffRole,
  type StaffStatus,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { Paginated } from '../../common/http/pagination';
import type { RequestAuth } from '../../common/auth.types';
import { hashPassword } from '../auth/crypto.util';
import { SessionService } from '../auth/session.service';
import { CreateStaffDto, ListStaffQueryDto, ResetStaffPasswordDto, UpdateStaffDto } from './dto/staff.dto';

const TEAM_ROLES: Role[] = [Role.MESS_OWNER, Role.MESS_MANAGER, Role.MESS_STAFF];
const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  mobile: true,
  email: true,
  status: true,
  lastLoginAt: true,
  mustChangePassword: true,
} as const satisfies Prisma.UserSelect;
const include = { user: { select: userSelect } } as const;
type Row = Prisma.MessMembershipGetPayload<{ include: typeof include }>;

const statusOf = (s: MembershipStatus): StaffStatus => (s === MembershipStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE');

/**
 * The mess team = users + their membership in this mess (no separate employee table).
 * Every query is scoped by the caller's messId; ids in URLs are user ids, looked up as (userId, messId).
 * Hierarchy (shared `TEAM_MANAGEABLE_ROLES`): owner manages managers and staff, manager manages staff only;
 * nobody manages an owner or themselves here, so a mess always keeps its owner.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async list(messId: string, actor: RequestAuth, q: ListStaffQueryDto): Promise<Paginated<StaffListItem>> {
    const where = this.listWhere(messId, q);
    const [rows, total] = await this.prisma.$transaction([
      // Owner first, then managers, then staff (enum order); active before inactive.
      this.prisma.messMembership.findMany({ where, include, orderBy: [{ role: 'asc' }, { status: 'asc' }, { createdAt: 'asc' }], skip: q.skip, take: q.pageSize }),
      this.prisma.messMembership.count({ where }),
    ]);
    return new Paginated(rows.map((r) => this.toItem(r, actor)), total, q);
  }

  async detail(messId: string, actor: RequestAuth, userId: string): Promise<StaffDetail> {
    return this.toDetail(await this.find(messId, userId), actor);
  }

  /**
   * New number → new team account with a temporary password (must be changed at first sign-in).
   * Known number → the existing team account is linked (no duplicate user; it keeps its password),
   * but only when that is safe: not a student/owner/admin account, not active in another mess, not already here.
   */
  async create(messId: string, actor: RequestAuth, dto: CreateStaffDto): Promise<CreateStaffResult> {
    this.assertCanAssign(actor, dto.role);
    const [byMobile, byEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { mobile: dto.mobile }, include: { memberships: true } }),
      dto.email ? this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }) : null,
    ]);
    if (byEmail && byEmail.id !== byMobile?.id) throw this.conflict('This email belongs to another account', { email: ['Already used by another account'] });

    if (byMobile) {
      this.assertReusable(byMobile, messId);
      await this.prisma.$transaction([
        this.prisma.messMembership.create({ data: { userId: byMobile.id, messId, role: dto.role } }),
        // Account type follows the (only) active team membership.
        this.prisma.user.update({ where: { id: byMobile.id }, data: { role: dto.role } }),
      ]);
      return { staff: await this.detail(messId, actor, byMobile.id), reusedAccount: true };
    }

    if (!dto.temporaryPassword) throw AppException.validation({ temporaryPassword: ['Set a temporary password for the new account'] });
    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          mobile: dto.mobile,
          email: dto.email ?? null,
          role: dto.role,
          passwordHash: await hashPassword(dto.temporaryPassword),
          mustChangePassword: true,
          memberships: { create: { messId, role: dto.role } },
        },
      });
      return { staff: await this.detail(messId, actor, user.id), reusedAccount: false };
    } catch (error) {
      // A concurrent request created the same mobile/email first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw this.conflict('This mobile number or email is already registered');
      throw error;
    }
  }

  async update(messId: string, actor: RequestAuth, userId: string, dto: UpdateStaffDto): Promise<StaffDetail> {
    const row = await this.find(messId, userId);
    this.assertCanManage(actor, row);
    if (dto.role && dto.role !== row.role) this.assertCanAssign(actor, dto.role);

    const emailChanged = dto.email !== undefined && dto.email !== row.user.email;
    if (emailChanged && dto.email) {
      const taken = await this.prisma.user.count({ where: { email: dto.email, id: { not: userId } } });
      if (taken) throw this.conflict('This email belongs to another account', { email: ['Already used by another account'] });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          ...(emailChanged ? { email: dto.email, emailVerified: false } : {}),
          ...(dto.role ? { role: dto.role } : {}),
        },
      }),
      ...(dto.role ? [this.prisma.messMembership.update({ where: { id: row.id }, data: { role: dto.role } })] : []),
    ]);
    // Email is a login id: changing it signs the person out everywhere.
    if (emailChanged) await this.sessions.revokeAllForUser(userId);
    return this.detail(messId, actor, userId);
  }

  /** Deactivate keeps the user and membership (history intact) and signs them out; reactivate restores access. */
  async setStatus(messId: string, actor: RequestAuth, userId: string, status: StaffStatus): Promise<StaffDetail> {
    const row = await this.find(messId, userId);
    this.assertCanManage(actor, row);
    if (statusOf(row.status) === status) {
      throw this.conflict(status === 'ACTIVE' ? 'This team member is already active' : 'This team member is already inactive');
    }
    if (status === 'ACTIVE') {
      const elsewhere = await this.prisma.messMembership.count({ where: { userId, status: MembershipStatus.ACTIVE, messId: { not: messId } } });
      if (elsewhere) throw this.conflict('This person now works at another mess and cannot be reactivated here');
    }
    await this.prisma.messMembership.update({ where: { id: row.id }, data: { status: status === 'ACTIVE' ? MembershipStatus.ACTIVE : MembershipStatus.REMOVED } });
    if (status === 'INACTIVE') await this.sessions.revokeAllForUser(userId);
    return this.detail(messId, actor, userId);
  }

  /** Sets a temporary password (never shown again), forces a change at next sign-in and signs out every session. */
  async resetPassword(messId: string, actor: RequestAuth, userId: string, dto: ResetStaffPasswordDto): Promise<StaffDetail> {
    const row = await this.find(messId, userId);
    this.assertCanManage(actor, row);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(dto.temporaryPassword), mustChangePassword: true } });
    await this.sessions.revokeAllForUser(userId);
    return this.detail(messId, actor, userId);
  }

  // ── Rules ──

  private assertCanManage(actor: RequestAuth, row: Row) {
    if (row.role === Role.MESS_OWNER) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.STAFF_CANNOT_MODIFY_OWNER, 'The owner cannot be changed from staff management');
    if (row.userId === actor.user.id) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.STAFF_CANNOT_MODIFY_SELF, 'Use Account settings to change your own details');
    if (!TEAM_MANAGEABLE_ROLES[actor.role].includes(row.role)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'Only the owner can manage managers');
    }
  }

  private assertCanAssign(actor: RequestAuth, role: StaffRole) {
    if (!STAFF_ASSIGNABLE_ROLES.includes(role) || !TEAM_MANAGEABLE_ROLES[actor.role].includes(role)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.STAFF_ROLE_INVALID, actor.role === Role.MESS_MANAGER ? 'Managers can only add or assign the Staff role' : 'This role cannot be assigned');
    }
  }

  private assertReusable(user: { id: string; role: Role; status: UserStatus; memberships: { messId: string; status: MembershipStatus }[] }, messId: string) {
    if (user.role === Role.STUDENT) throw this.conflict('This mobile number belongs to a student app account', { mobile: ['Used by a student account'] });
    if (!TEAM_ROLES.includes(user.role) || user.role === Role.MESS_OWNER) {
      throw this.conflict('This mobile number belongs to an account that cannot be added as staff', { mobile: ['Not available'] });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.STAFF_ACCOUNT_DISABLED, 'This account is disabled. Contact support.', { mobile: ['Account disabled'] });
    }
    const here = user.memberships.find((m) => m.messId === messId);
    if (here) {
      throw this.conflict(
        here.status === MembershipStatus.ACTIVE ? 'This person is already in your team' : 'This person was deactivated earlier. Open their profile and reactivate them instead.',
        { mobile: ['Already in your team'] },
      );
    }
    if (user.memberships.some((m) => m.status === MembershipStatus.ACTIVE)) {
      throw this.conflict('This person already works at another mess', { mobile: ['Works at another mess'] });
    }
  }

  // ── Queries / mapping ──

  private async find(messId: string, userId: string): Promise<Row> {
    const row = await this.prisma.messMembership.findUnique({ where: { userId_messId: { userId, messId } }, include });
    if (!row || !TEAM_ROLES.includes(row.role)) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STAFF_NOT_FOUND, 'Team member not found');
    return row;
  }

  private listWhere(messId: string, q: ListStaffQueryDto): Prisma.MessMembershipWhereInput {
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const terms = (q.search ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
    return {
      messId,
      role: q.role ?? { in: TEAM_ROLES },
      ...(q.status ? { status: q.status === 'ACTIVE' ? MembershipStatus.ACTIVE : { not: MembershipStatus.ACTIVE } } : {}),
      user: {
        AND: terms.map((t) => {
          const digits = normalizeMobile(t) ?? t.replace(/\D/g, '');
          return { OR: [{ firstName: contains(t) }, { lastName: contains(t) }, { email: contains(t) }, ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : [])] };
        }),
      },
    };
  }

  private toItem(r: Row, actor: RequestAuth): StaffListItem {
    return {
      id: r.user.id,
      membershipId: r.id,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      mobile: r.user.mobile,
      email: r.user.email,
      role: r.role,
      status: statusOf(r.status),
      accountStatus: r.user.status,
      addedAt: r.createdAt.toISOString(),
      lastLoginAt: r.user.lastLoginAt?.toISOString() ?? null,
      isSelf: r.userId === actor.user.id,
      actions: staffActionsFor({ userId: actor.user.id, role: actor.role }, { userId: r.userId, role: r.role }),
    };
  }

  private toDetail(r: Row, actor: RequestAuth): StaffDetail {
    const item = this.toItem(r, actor);
    return {
      ...item,
      membershipStatus: r.status,
      mustChangePassword: r.user.mustChangePassword,
      updatedAt: r.updatedAt.toISOString(),
      assignableRoles: item.actions.edit ? STAFF_ASSIGNABLE_ROLES.filter((role) => TEAM_MANAGEABLE_ROLES[actor.role].includes(role)) : [],
    };
  }

  private conflict(message: string, fields?: Record<string, string[]>) {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.STAFF_ALREADY_EXISTS, message, fields);
  }
}
