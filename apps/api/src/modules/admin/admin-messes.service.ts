import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AttendanceStatus, MessStatus, Prisma, StudentStatus } from '@prisma/client';
import {
  addDays,
  AuditAction,
  AuditTargetType,
  businessToday,
  ErrorCode,
  MEAL_KEYS,
  normalizeMobile,
  SubscriptionStatus,
  type AdminMessDetail,
  type AdminMessListItem,
  type AdminRecordType,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, timestampRange } from '../../common/http/dates';
import { Paginated } from '../../common/http/pagination';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ListAttendanceQueryDto } from '../attendance/dto/attendance.dto';
import { ComplaintsService } from '../complaints/complaints.service';
import { ListComplaintsQueryDto } from '../complaints/dto/complaint.dto';
import { ExpenseSummaryService } from '../expenses/expense-summary.service';
import { ListPaymentsQueryDto } from '../payments/dto/payment.dto';
import { ReportsService } from '../reports/reports.service';
import { ListStudentsQueryDto } from '../students/dto/student.dto';
import { ListSubscriptionsQueryDto } from '../subscriptions/dto/subscription.dto';
import { expiringSoonWhere, statusWhere } from '../subscriptions/subscription.rules';
import { resolveBilling } from '../billing/billing.service';
import type { AdminMessListQueryDto, AdminRecordsQueryDto } from './dto/admin.dto';

const fullName = (p: { firstName: string; lastName: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(' ');
const ownerSelect = { id: true, firstName: true, lastName: true, mobile: true, email: true } as const;

/** Each record view uses the owner's own list DTO, so filters/sorting/tenant scope are identical to the mess screens. */
const RECORD_DTOS = {
  students: ListStudentsQueryDto,
  subscriptions: ListSubscriptionsQueryDto,
  attendance: ListAttendanceQueryDto,
  payments: ListPaymentsQueryDto,
  complaints: ListComplaintsQueryDto,
} as const satisfies Record<AdminRecordType, new () => object>;

/** Cross-mess monitoring and the mess on/off switch. The admin never edits a mess's business data. */
@Injectable()
export class AdminMessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reports: ReportsService,
    private readonly attendance: AttendanceService,
    private readonly expenses: ExpenseSummaryService,
    private readonly complaints: ComplaintsService,
  ) {}

  async list(q: AdminMessListQueryDto): Promise<Paginated<AdminMessListItem>> {
    const where = this.listWhere(q);
    const order = q.sortOrder ?? (q.sortBy && q.sortBy !== 'createdAt' ? 'asc' : 'desc');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mess.findMany({
        where,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          messType: true,
          status: true,
          createdAt: true,
          owner: { select: ownerSelect },
          _count: { select: { students: { where: { status: StudentStatus.ACTIVE } } } },
          platformSubscriptions: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
        orderBy: [{ [q.sortBy ?? 'createdAt']: order }, { id: 'asc' }],
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.mess.count({ where }),
    ]);
    return new Paginated(
      rows.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        state: m.state,
        messType: m.messType,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        owner: { id: m.owner.id, name: fullName(m.owner), mobile: m.owner.mobile, email: m.owner.email },
        activeStudents: m._count.students,
        billingStatus: resolveBilling(m.platformSubscriptions).status,
      })),
      total,
      q,
    );
  }

  async detail(id: string): Promise<AdminMessDetail> {
    const mess = await this.prisma.mess.findUnique({ where: { id }, include: { owner: { select: { ...ownerSelect, status: true, lastLoginAt: true } } } });
    if (!mess) throw this.notFound();
    const today = businessToday();
    const [team, studentGroups, appLinked, activeSubs, expiring, attendanceToday, week, finance, complaints, suspension, recentActivity] = await Promise.all([
      this.prisma.messMembership.findMany({
        where: { messId: id },
        select: { role: true, status: true, user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: 50,
      }),
      this.prisma.messStudent.groupBy({ by: ['status'], where: { messId: id }, _count: { _all: true } }),
      this.prisma.messStudent.count({ where: { messId: id, status: { not: StudentStatus.ARCHIVED }, userId: { not: null } } }),
      this.prisma.studentSubscription.count({ where: { messId: id, ...statusWhere(SubscriptionStatus.ACTIVE, today) } }),
      this.prisma.studentSubscription.count({ where: { messId: id, ...expiringSoonWhere(today) } }),
      this.attendance.summary(id, today),
      this.prisma.mealAttendance.count({
        where: { messId: id, status: AttendanceStatus.SERVED, attendanceDate: { gte: fromDateString(addDays(today, -6)), lte: fromDateString(today) } },
      }),
      this.expenses.financeMonthly(id, today.slice(0, 7)),
      this.complaints.counts(id),
      mess.status === MessStatus.SUSPENDED ? this.audit.lastSuspension(AuditTargetType.MESS, id, AuditAction.MESS_SUSPENDED) : null,
      this.audit.recent({ messId: id }),
    ]);
    const count = (s: StudentStatus) => studentGroups.find((g) => g.status === s)?._count._all ?? 0;
    return {
      mess: {
        id: mess.id,
        name: mess.name,
        mobile: mess.mobile,
        email: mess.email,
        messType: mess.messType,
        foodType: mess.foodType,
        address: mess.address,
        city: mess.city,
        state: mess.state,
        pincode: mess.pincode,
        openingTime: mess.openingTime,
        closingTime: mess.closingTime,
        meals: { breakfast: mess.breakfastAvailable, lunch: mess.lunchAvailable, dinner: mess.dinnerAvailable },
        status: mess.status,
        createdAt: mess.createdAt.toISOString(),
        updatedAt: mess.updatedAt.toISOString(),
      },
      owner: {
        id: mess.owner.id,
        name: fullName(mess.owner),
        mobile: mess.owner.mobile,
        email: mess.owner.email,
        status: mess.owner.status,
        lastLoginAt: mess.owner.lastLoginAt?.toISOString() ?? null,
      },
      suspension,
      team: team.map((m) => ({ id: m.user.id, name: fullName(m.user), role: m.role, status: m.status })),
      students: {
        total: count(StudentStatus.ACTIVE) + count(StudentStatus.INACTIVE),
        active: count(StudentStatus.ACTIVE),
        inactive: count(StudentStatus.INACTIVE),
        appLinked,
      },
      subscriptions: { active: activeSubs, expiringSoon: expiring },
      attendance: {
        today: { ...Object.fromEntries(MEAL_KEYS.map((k) => [k, attendanceToday[k]])), total: attendanceToday.total } as AdminMessDetail['attendance']['today'],
        last7Days: week,
      },
      finance,
      complaints,
      recentActivity,
    };
  }

  /** Read-only list of one mess's records, through the same report query the owner uses. */
  async records(id: string, type: AdminRecordType, q: AdminRecordsQueryDto) {
    await this.assertExists(id);
    const today = businessToday();
    const plain: Record<string, unknown> = { page: q.page, pageSize: q.pageSize, search: q.search };
    if (type === 'attendance') Object.assign(plain, { from: q.from ?? addDays(today, -6), to: q.to ?? today });
    if (type === 'payments' || type === 'complaints') Object.assign(plain, { from: q.from, to: q.to });
    const dto: new () => object = RECORD_DTOS[type];
    const query = plainToInstance(dto, plain, { exposeDefaultValues: true });
    return this.reports.run(type, id, query as never);
  }

  async suspend(actorUserId: string, id: string, reason: string) {
    return this.setStatus(actorUserId, id, MessStatus.SUSPENDED, reason);
  }

  async reactivate(actorUserId: string, id: string, reason?: string) {
    return this.setStatus(actorUserId, id, MessStatus.ACTIVE, reason);
  }

  /** Status flip + audit entry in one transaction; conditional update so double clicks can't log twice. Data is never touched. */
  private async setStatus(actorUserId: string, id: string, status: MessStatus, reason?: string) {
    const mess = await this.prisma.mess.findUnique({ where: { id }, select: { name: true, status: true } });
    if (!mess) throw this.notFound();
    const suspending = status === MessStatus.SUSPENDED;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.mess.updateMany({ where: { id, status: suspending ? MessStatus.ACTIVE : MessStatus.SUSPENDED }, data: { status } });
      if (count === 0) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.ADMIN_ACTION_NOT_ALLOWED, suspending ? 'This mess is already suspended' : 'This mess is already active');
      }
      await this.audit.record(
        {
          actorUserId,
          action: suspending ? AuditAction.MESS_SUSPENDED : AuditAction.MESS_REACTIVATED,
          targetType: AuditTargetType.MESS,
          targetId: id,
          messId: id,
          reason: reason || null,
          label: mess.name,
        },
        tx,
      );
    });
    return this.detail(id);
  }

  private listWhere(q: AdminMessListQueryDto): Prisma.MessWhereInput {
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const and: Prisma.MessWhereInput[] = [];
    for (const term of (q.search ?? '').split(/\s+/).filter(Boolean).slice(0, 5)) {
      const digits = normalizeMobile(term) ?? term.replace(/\D/g, '');
      and.push({
        OR: [
          { name: contains(term) },
          { city: contains(term) },
          { owner: { OR: [{ firstName: contains(term) }, { lastName: contains(term) }, { email: contains(term) }] } },
          ...(digits.length >= 3 ? [{ mobile: { contains: digits } }, { owner: { mobile: { contains: digits } } }] : []),
        ],
      });
    }
    return {
      AND: and,
      status: q.status,
      messType: q.messType,
      ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
      createdAt: timestampRange(q.from, q.to),
    };
  }

  private async assertExists(id: string) {
    if (!(await this.prisma.mess.count({ where: { id } }))) throw this.notFound();
  }

  private notFound() {
    return AppException.notFound('Mess not found');
  }
}

