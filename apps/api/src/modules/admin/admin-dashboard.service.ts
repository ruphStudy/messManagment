import { Injectable } from '@nestjs/common';
import { AttendanceStatus, ComplaintStatus, MessStatus, PaymentStatus, PushStatus, Role, StudentStatus, UserStatus } from '@prisma/client';
import { addDays, businessToday, SubscriptionStatus, type AdminDashboard } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDayStart, fromDateString } from '../../common/http/dates';
import { expiringSoonWhere, statusWhere } from '../subscriptions/subscription.rules';

const DAY_MS = 86_400_000;

/**
 * Platform-wide counts. All SQL aggregation (count/groupBy/sum), never row loads; the definitions are the
 * same ones the mess screens use (SERVED attendance, RECORDED payments, subscription status rules).
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdminDashboard> {
    const today = businessToday();
    const month = today.slice(0, 7);
    const monthStart = fromDateString(`${month}-01`);
    // createdAt is a timestamp: "this month" starts at IST midnight.
    const monthStartAt = businessDayStart(`${month}-01`);
    const week = fromDateString(addDays(today, -6));
    const now = Date.now();
    const p = this.prisma;

    const [messGroups, newMesses, roleGroups, disabled, studentGroups, unlinked, newStudents] = await Promise.all([
      p.mess.groupBy({ by: ['status'], _count: { _all: true } }),
      p.mess.count({ where: { createdAt: { gte: monthStartAt } } }),
      p.user.groupBy({ by: ['role'], _count: { _all: true } }),
      p.user.count({ where: { status: UserStatus.DISABLED } }),
      p.messStudent.groupBy({ by: ['status'], _count: { _all: true } }),
      p.messStudent.count({ where: { userId: null, status: { not: StudentStatus.ARCHIVED } } }),
      p.messStudent.count({ where: { status: { not: StudentStatus.ARCHIVED }, createdAt: { gte: monthStartAt } } }),
    ]);
    const [servedToday, servedWeek, activeToday, activeWeek, activeSubs, totalSubs, expiring, payments] = await Promise.all([
      p.mealAttendance.count({ where: { status: AttendanceStatus.SERVED, attendanceDate: fromDateString(today) } }),
      p.mealAttendance.count({ where: { status: AttendanceStatus.SERVED, attendanceDate: { gte: week, lte: fromDateString(today) } } }),
      this.distinctMesses(fromDateString(today)),
      this.distinctMesses(week),
      p.studentSubscription.count({ where: statusWhere(SubscriptionStatus.ACTIVE, today) }),
      p.studentSubscription.count({ where: { cancelledAt: null } }),
      p.studentSubscription.count({ where: expiringSoonWhere(today) }),
      p.payment.aggregate({ where: { status: PaymentStatus.RECORDED, paymentDate: { gte: monthStart } }, _count: { _all: true }, _sum: { amountPaise: true } }),
    ]);
    const [complaintGroups, newComplaints, prevComplaints, pushFailed, devices] = await Promise.all([
      p.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
      p.complaint.count({ where: { createdAt: { gte: new Date(now - 7 * DAY_MS) } } }),
      p.complaint.count({ where: { createdAt: { gte: new Date(now - 14 * DAY_MS), lt: new Date(now - 7 * DAY_MS) } } }),
      p.notification.count({ where: { pushStatus: PushStatus.FAILED, createdAt: { gte: new Date(now - 7 * DAY_MS) } } }),
      p.pushDevice.count({ where: { isActive: true } }),
    ]);

    const by = <K extends string>(groups: { _count: { _all: number } }[], key: string, value: K) =>
      (groups as ({ _count: { _all: number } } & Record<string, unknown>)[]).find((g) => g[key] === value)?._count._all ?? 0;
    const studentsTotal = studentGroups.filter((g) => g.status !== StudentStatus.ARCHIVED).reduce((n, g) => n + g._count._all, 0);

    return {
      dates: { today, month },
      messes: {
        total: messGroups.reduce((n, g) => n + g._count._all, 0),
        active: by(messGroups, 'status', MessStatus.ACTIVE),
        suspended: by(messGroups, 'status', MessStatus.SUSPENDED),
        newThisMonth: newMesses,
      },
      users: {
        owners: by(roleGroups, 'role', Role.MESS_OWNER),
        managers: by(roleGroups, 'role', Role.MESS_MANAGER),
        staff: by(roleGroups, 'role', Role.MESS_STAFF),
        studentAccounts: by(roleGroups, 'role', Role.STUDENT),
        disabled,
      },
      students: { total: studentsTotal, active: by(studentGroups, 'status', StudentStatus.ACTIVE), unlinked, newThisMonth: newStudents },
      usage: {
        mealsServedToday: servedToday,
        mealsServedLast7Days: servedWeek,
        activeMessesToday: activeToday,
        activeMessesLast7Days: activeWeek,
        activeSubscriptions: activeSubs,
        totalSubscriptions: totalSubs,
        expiringSubscriptions: expiring,
        paymentsThisMonth: { count: payments._count._all, amountPaise: payments._sum.amountPaise ?? 0 },
      },
      complaints: {
        open: by(complaintGroups, 'status', ComplaintStatus.OPEN),
        inProgress: by(complaintGroups, 'status', ComplaintStatus.IN_PROGRESS),
        newLast7Days: newComplaints,
        newPrevious7Days: prevComplaints,
      },
      notifications: { pushFailedLast7Days: pushFailed, activeDevices: devices },
    };
  }

  /** Messes that served at least one meal since `from` (through today). */
  private async distinctMesses(from: Date): Promise<number> {
    const [row] = await this.prisma.$queryRaw<[{ n: bigint }]>`
      SELECT COUNT(DISTINCT "messId") AS n FROM meal_attendance WHERE status = 'SERVED' AND "attendanceDate" >= ${from}::date`;
    return Number(row.n);
  }
}
