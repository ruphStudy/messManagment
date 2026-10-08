import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role, StudentStatus, UserStatus } from '@prisma/client';
import { AuditAction, AuditTargetType, ErrorCode, normalizeMobile, type AdminUserDetail, type AdminUserListItem } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { timestampRange, toDateString } from '../../common/http/dates';
import { Paginated } from '../../common/http/pagination';
import { AuditService } from '../audit/audit.service';
import type { AdminUserListQueryDto } from './dto/admin.dto';

const fullName = (p: { firstName: string; lastName: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(' ');

/**
 * Platform user accounts. Only safe identity fields are ever selected — never password hashes, sessions,
 * OTPs or push tokens.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: AdminUserListQueryDto): Promise<Paginated<AdminUserListItem>> {
    const where = this.listWhere(q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          memberships: { select: { role: true, mess: { select: { id: true, name: true } } }, take: 5 },
          studentProfiles: { where: { status: { not: StudentStatus.ARCHIVED } }, select: { mess: { select: { id: true, name: true } } }, take: 5 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return new Paginated(
      rows.map((u) => ({
        id: u.id,
        name: fullName(u),
        mobile: u.mobile,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        messes: [
          ...u.memberships.map((m) => ({ messId: m.mess.id, messName: m.mess.name, role: m.role })),
          ...u.studentProfiles.map((s) => ({ messId: s.mess.id, messName: s.mess.name, role: Role.STUDENT })),
        ],
      })),
      total,
      q,
    );
  }

  async detail(actorUserId: string, id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        email: true,
        role: true,
        status: true,
        mobileVerified: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        memberships: { select: { role: true, status: true, createdAt: true, mess: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: 'asc' } },
        ownedMesses: { select: { id: true, name: true, status: true } },
        studentProfiles: { select: { id: true, status: true, joiningDate: true, mess: { select: { id: true, name: true } } }, orderBy: { joiningDate: 'desc' } },
      },
    });
    if (!user) throw this.notFound();
    const { memberships, ownedMesses, studentProfiles, ...profile } = user;
    const [suspension, recentActivity] = await Promise.all([
      user.status === UserStatus.DISABLED ? this.audit.lastSuspension(AuditTargetType.USER, id, AuditAction.USER_SUSPENDED) : null,
      this.audit.recent({ OR: [{ targetType: AuditTargetType.USER, targetId: id }, { actorUserId: id }] }),
    ]);
    return {
      user: {
        ...profile,
        lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
      memberships: memberships.map((m) => ({ messId: m.mess.id, messName: m.mess.name, messStatus: m.mess.status, role: m.role, status: m.status, since: m.createdAt.toISOString() })),
      ownedMesses,
      studentRecords: studentProfiles.map((s) => ({ id: s.id, messId: s.mess.id, messName: s.mess.name, status: s.status, joiningDate: toDateString(s.joiningDate) })),
      suspension,
      canChangeStatus: this.canChangeStatus(actorUserId, user),
      recentActivity,
    };
  }

  async suspend(actorUserId: string, id: string, reason: string) {
    return this.setStatus(actorUserId, id, UserStatus.DISABLED, reason);
  }

  async reactivate(actorUserId: string, id: string, reason?: string) {
    return this.setStatus(actorUserId, id, UserStatus.ACTIVE, reason);
  }

  /** Platform admins (incl. yourself) are never switched off from the portal. */
  private canChangeStatus(actorUserId: string, user: { id: string; role: Role }) {
    return user.id !== actorUserId && user.role !== Role.PLATFORM_ADMIN;
  }

  /**
   * Suspending disables the account (login blocked by the Sprint 1 status check, which also runs on every
   * request) and revokes its sessions. Nothing is deleted; reactivation lets the user sign in again.
   */
  private async setStatus(actorUserId: string, id: string, status: UserStatus, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, firstName: true, lastName: true, status: true } });
    if (!user) throw this.notFound();
    if (!this.canChangeStatus(actorUserId, user)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ADMIN_ACTION_NOT_ALLOWED, 'Platform admin accounts cannot be suspended from the portal');
    }
    const suspending = status === UserStatus.DISABLED;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({ where: { id, status: suspending ? UserStatus.ACTIVE : UserStatus.DISABLED }, data: { status } });
      if (count === 0) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.ADMIN_ACTION_NOT_ALLOWED, suspending ? 'This account is already suspended' : 'This account is already active');
      }
      if (suspending) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(
        {
          actorUserId,
          action: suspending ? AuditAction.USER_SUSPENDED : AuditAction.USER_REACTIVATED,
          targetType: AuditTargetType.USER,
          targetId: id,
          reason: reason || null,
          label: fullName(user),
        },
        tx,
      );
    });
    return this.detail(actorUserId, id);
  }

  private listWhere(q: AdminUserListQueryDto): Prisma.UserWhereInput {
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const and: Prisma.UserWhereInput[] = [];
    for (const term of (q.search ?? '').split(/\s+/).filter(Boolean).slice(0, 5)) {
      const digits = normalizeMobile(term) ?? term.replace(/\D/g, '');
      and.push({ OR: [{ firstName: contains(term) }, { lastName: contains(term) }, { email: contains(term) }, ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : [])] });
    }
    if (q.messId) {
      and.push({ OR: [{ memberships: { some: { messId: q.messId } } }, { studentProfiles: { some: { messId: q.messId } } }] });
    }
    return {
      AND: and,
      role: q.role,
      status: q.status,
      createdAt: timestampRange(q.from, q.to),
    };
  }

  private notFound() {
    return AppException.notFound('User not found');
  }
}
