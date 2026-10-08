import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, StudentStatus } from '@prisma/client';
import {
  addDays,
  businessToday,
  daysBetween,
  EXPIRY_REMINDER_DAYS,
  formatPaise,
  formatShortDate,
  NOTIFICATION_LIMITS,
  NotificationScreen,
  REMINDER_REASON_LABELS,
  ReminderReason,
  type ExpiryRunResult,
  type ReminderResult,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { NotificationsService } from '../notifications/notifications.service';
import { BulkPaymentReminderDto, SendReminderDto } from './dto/reminder.dto';

/** Window in which the same reminder to the same student is treated as a double click. */
const PAYMENT_DEDUPE_MS = 10 * 60_000;
const MANUAL_DEDUPE_MS = 60_000;

const bucket = (ms: number) => Math.floor(Date.now() / ms);
/** Identical reminders (same reason + note) within the window are a double click; a different note is a new reminder. */
const noteHash = (note?: string) => createHash('sha1').update(note ?? '').digest('hex').slice(0, 10);
const fullName = (s: { firstName: string; lastName: string | null }) => [s.firstName, s.lastName].filter(Boolean).join(' ');

interface StudentDues {
  id: string;
  messId: string;
  name: string;
  userId: string | null;
  status: StudentStatus;
  messName: string;
  duePaise: number;
  plans: string[];
}

/**
 * Reminders are informational only: they never create or change payments, subscriptions or credits.
 * Payment reminders are manual (owner/manager); only subscription-expiry reminders run automatically.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendToStudent(messId: string, actorId: string, studentId: string, dto: SendReminderDto): Promise<ReminderResult> {
    const [student] = await this.loadDues(messId, [studentId]);
    if (!student) throw AppException.notFound('Student not found');
    if (dto.reason === ReminderReason.PAYMENT) return this.paymentReminders(actorId, [student], dto.note);

    const result: ReminderResult = { sent: [], skipped: [], failed: [] };
    if (!this.reachable(student, result)) return result;
    const title = REMINDER_REASON_LABELS[dto.reason];
    const defaults: Record<Exclude<ReminderReason, 'PAYMENT'>, string> = {
      RENEWAL: 'Your meal plan needs renewal. Please contact your mess.',
      CONTACT_MESS: 'Please contact your mess.',
      GENERAL: `Reminder from ${student.messName}.`,
    };
    const outcome = await this.notifications.notify(
      [{ userId: student.userId!, messId, dedupeKey: `manual:${student.id}:${dto.reason}:${noteHash(dto.note)}:${bucket(MANUAL_DEDUPE_MS)}` }],
      {
        type: NotificationType.MANUAL_REMINDER,
        title: `${student.messName}: ${title}`,
        body: dto.note ?? defaults[dto.reason as Exclude<ReminderReason, 'PAYMENT'>],
        data: { screen: dto.reason === ReminderReason.RENEWAL ? NotificationScreen.PLANS : NotificationScreen.HOME },
        createdById: actorId,
      },
    );
    this.record(student, outcome, result, 'Already reminded a moment ago');
    return result;
  }

  async bulkPayment(messId: string, actorId: string, dto: BulkPaymentReminderDto): Promise<ReminderResult> {
    let ids = dto.studentIds ?? [];
    if (dto.allWithDues) {
      const owing = await this.prisma.studentSubscription.findMany({
        where: {
          messId,
          cancelledAt: null,
          amountPaidPaise: { lt: this.prisma.studentSubscription.fields.planPricePaise },
          student: { status: { not: StudentStatus.ARCHIVED } },
        },
        select: { studentId: true },
        distinct: ['studentId'],
        take: NOTIFICATION_LIMITS.bulkMax,
      });
      ids = owing.map((o) => o.studentId);
    }
    const students = await this.loadDues(messId, ids);
    const result = await this.paymentReminders(actorId, students);
    // Ids that aren't students of this mess are reported without revealing anything about them.
    for (const id of ids.filter((id) => !students.some((s) => s.id === id))) {
      result.failed.push({ studentId: id, name: 'Unknown', reason: 'Student not found' });
    }
    return result;
  }

  /**
   * Plans ending within EXPIRY_REMINDER_DAYS (with nothing lined up after them) get one reminder,
   * plus one on the last day. Dedupe keys make re-runs and restarts harmless.
   */
  async runExpiry(today = businessToday(), messId?: string): Promise<ExpiryRunResult> {
    const subs = await this.prisma.studentSubscription.findMany({
      where: {
        messId,
        cancelledAt: null,
        endDate: { gte: fromDateString(today), lte: fromDateString(addDays(today, EXPIRY_REMINDER_DAYS)) },
        student: {
          status: StudentStatus.ACTIVE,
          userId: { not: null },
          subscriptions: { none: { cancelledAt: null, startDate: { gt: fromDateString(today) } } },
        },
      },
      select: { id: true, messId: true, planName: true, endDate: true, student: { select: { userId: true } } },
    });

    const result: ExpiryRunResult = { date: today, notified: 0, skippedDuplicates: 0 };
    const perMess = new Map<string, number>();
    for (const sub of subs) {
      const endDate = toDateString(sub.endDate);
      const lastDay = daysBetween(today, endDate) === 0;
      try {
        const outcome = await this.notifications.notify(
          [{ userId: sub.student.userId!, messId: sub.messId, dedupeKey: `subscription-expiry:${sub.id}:${lastDay ? 'last-day' : `${EXPIRY_REMINDER_DAYS}d`}` }],
          {
            type: NotificationType.SUBSCRIPTION_EXPIRING,
            title: lastDay ? 'Your plan ends today' : 'Your plan ends soon',
            body: `Your ${sub.planName} plan ${lastDay ? 'ends today' : `ends on ${formatShortDate(endDate)}`}. Please contact your mess to renew.`,
            data: { screen: NotificationScreen.HOME },
          },
        );
        result.notified += outcome.createdUserIds.length;
        result.skippedDuplicates += outcome.duplicateUserIds.length;
        perMess.set(sub.messId, (perMess.get(sub.messId) ?? 0) + 1);
      } catch (error) {
        this.logger.warn(`Expiry reminder failed for subscription ${sub.id}: ${(error as Error).message}`);
      }
    }

    // One short daily notice for the owner/manager of each affected mess.
    for (const [id, count] of perMess) {
      await this.notifications.notifySafely(await this.notifications.teamTargets(id, `expiry-summary:${id}:${today}`), {
        type: NotificationType.SYSTEM,
        title: `${count} ${count === 1 ? 'plan ends' : 'plans end'} soon`,
        body: `${count} student ${count === 1 ? 'plan ends' : 'plans end'} within ${EXPIRY_REMINDER_DAYS} days with no renewal scheduled.`,
        data: { screen: NotificationScreen.SUBSCRIPTIONS },
      });
    }
    return result;
  }

  private async paymentReminders(actorId: string, students: StudentDues[], note?: string): Promise<ReminderResult> {
    const result: ReminderResult = { sent: [], skipped: [], failed: [] };
    for (const s of students) {
      if (s.duePaise <= 0) {
        result.skipped.push({ studentId: s.id, name: s.name, reason: 'Nothing due' });
        continue;
      }
      if (!this.reachable(s, result)) continue;
      try {
        const plans = s.plans.length === 1 ? ` for ${s.plans[0]}` : '';
        const outcome = await this.notifications.notify(
          [{ userId: s.userId!, messId: s.messId, dedupeKey: `payment-due:${s.id}:${bucket(PAYMENT_DEDUPE_MS)}` }],
          {
            type: NotificationType.PAYMENT_DUE,
            title: `Payment reminder: ${formatPaise(s.duePaise)} due`,
            body: `${formatPaise(s.duePaise)} is due${plans}. Please pay at ${s.messName}.${note ? ` ${note}` : ''}`,
            data: { screen: NotificationScreen.PAYMENTS },
            createdById: actorId,
          },
        );
        this.record(s, outcome, result, 'Already reminded in the last few minutes', 'Student turned off payment reminders');
      } catch (error) {
        this.logger.warn(`Payment reminder failed for ${s.id}: ${(error as Error).message}`);
        result.failed.push({ studentId: s.id, name: s.name, reason: 'Could not create the reminder' });
      }
    }
    return result;
  }

  /** Students the mess can reach: not archived and using the app. */
  private reachable(s: StudentDues, result: ReminderResult) {
    if (s.status === StudentStatus.ARCHIVED) {
      result.skipped.push({ studentId: s.id, name: s.name, reason: 'Student is archived' });
      return false;
    }
    if (!s.userId) {
      result.skipped.push({ studentId: s.id, name: s.name, reason: 'Not using the app yet' });
      return false;
    }
    return true;
  }

  private record(
    s: StudentDues,
    outcome: Awaited<ReturnType<NotificationsService['notify']>>,
    result: ReminderResult,
    duplicateReason: string,
    optedOutReason = 'Student turned off these notifications',
  ) {
    if (outcome.createdUserIds.length) result.sent.push({ studentId: s.id, name: s.name });
    else if (outcome.optedOutUserIds.length) result.skipped.push({ studentId: s.id, name: s.name, reason: optedOutReason });
    else result.skipped.push({ studentId: s.id, name: s.name, reason: duplicateReason });
  }

  /** Students of THIS mess with their current total due (non-cancelled subscriptions). */
  private async loadDues(messId: string, ids: string[]): Promise<StudentDues[]> {
    if (!ids.length) return [];
    const students = await this.prisma.messStudent.findMany({
      where: { id: { in: ids }, messId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        status: true,
        mess: { select: { name: true } },
        subscriptions: { where: { cancelledAt: null }, select: { planName: true, planPricePaise: true, amountPaidPaise: true } },
      },
    });
    return students.map((s) => {
      const owing = s.subscriptions.filter((sub) => sub.amountPaidPaise < sub.planPricePaise);
      return {
        id: s.id,
        messId,
        name: fullName(s),
        userId: s.userId,
        status: s.status,
        messName: s.mess.name,
        duePaise: owing.reduce((sum, sub) => sum + sub.planPricePaise - sub.amountPaidPaise, 0),
        plans: owing.map((sub) => sub.planName),
      };
    });
  }

}
