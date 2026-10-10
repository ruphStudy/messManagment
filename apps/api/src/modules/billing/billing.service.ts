import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PlatformSubscription } from '@prisma/client';
import {
  addDays,
  calculateEndDate,
  PlanDurationType,
  AuditAction,
  AuditTargetType,
  BillingCycle,
  businessToday,
  daysBetween,
  ErrorCode,
  PLATFORM_TRIAL_DAYS,
  PlatformSubscriptionStatus,
  type AdminBillingDetail,
  type BillingRecordPhase,
  type PlatformBillingSummary,
  type PlatformSubscriptionRecord,
} from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { AuditService } from '../audit/audit.service';

const d = (v: Date | null) => (v ? toDateString(v) : null);
const BILLING_HISTORY_LIMIT = 50;

const periodOf = (r: PlatformSubscription) =>
  r.status === 'TRIAL' ? { from: d(r.trialStartDate), to: d(r.trialEndDate) } : r.status === 'ACTIVE' ? { from: d(r.startDate), to: d(r.endDate) } : null;

/**
 * Resolves MessMate access from the history (any order). Business dates (IST), inclusive on both ends.
 * - A period row (ACTIVE/TRIAL) is CURRENT when from ≤ today ≤ to, UPCOMING when from > today, PAST when to < today.
 * - Only an admin cutoff (EXPIRED/SUSPENDED) ends the periods recorded before it.
 *   PENDING_PAYMENT is the initial/fallback state only and never overrides a paid or trial period.
 * - Several current periods (e.g. trial then payment): the most recently recorded wins.
 * - No current period: EXPIRED if a period has ended, else the latest admin cutoff, else PENDING_PAYMENT.
 */
export function resolveBilling(rows: PlatformSubscription[], today = businessToday()) {
  const sorted = [...rows].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
  const isCutoff = (r: PlatformSubscription) => r.status === 'EXPIRED' || r.status === 'SUSPENDED';
  const barrierIdx = sorted.findIndex(isCutoff);
  const barrier = barrierIdx >= 0 ? sorted[barrierIdx] : null;
  const live = (barrierIdx >= 0 ? sorted.slice(0, barrierIdx) : sorted).filter((r) => periodOf(r));
  const pending = sorted.find((r) => r.status === 'PENDING_PAYMENT') ?? null;
  const phase = new Map<string, BillingRecordPhase>();
  for (const r of live) {
    const p = periodOf(r)!;
    if (!p.from || !p.to) continue;
    phase.set(r.id, today < p.from ? 'UPCOMING' : today > p.to ? 'PAST' : 'CURRENT');
  }
  const current = live.find((r) => phase.get(r.id) === 'CURRENT') ?? null;
  const upcoming = live.filter((r) => phase.get(r.id) === 'UPCOMING').sort((x, y) => periodOf(x)!.from!.localeCompare(periodOf(y)!.from!));
  if (current) {
    return { status: current.status as PlatformSubscriptionStatus, accessAllowed: true, accessUntil: periodOf(current)!.to, current, upcoming, phase };
  }
  // No access today: the latest ended period (EXPIRED), else the admin cutoff, else pending payment.
  const ended = live.find((r) => phase.get(r.id) === 'PAST') ?? null;
  const status = ended ? PlatformSubscriptionStatus.EXPIRED : ((barrier?.status as PlatformSubscriptionStatus) ?? PlatformSubscriptionStatus.PENDING_PAYMENT);
  return { status, accessAllowed: false, accessUntil: ended ? periodOf(ended)!.to : null, current: ended ?? barrier ?? pending, upcoming, phase };
}

const toRecord = (r: PlatformSubscription): PlatformSubscriptionRecord => ({
  id: r.id,
  status: r.status,
  planName: r.planName,
  billingCycle: r.billingCycle,
  amountPaise: r.amountPaise,
  startDate: d(r.startDate),
  endDate: d(r.endDate),
  trialStartDate: d(r.trialStartDate),
  trialEndDate: d(r.trialEndDate),
  paymentReference: r.paymentReference,
  notes: r.notes,
  createdAt: r.createdAt.toISOString(),
});

/**
 * MessMate (SaaS) access per mess — separate from student meal plans/payments and from platform suspension.
 * History is append-only (one row per change); the newest row is current. Recorded manually by platform admins.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async resolve(messId: string) {
    const rows = await this.prisma.platformSubscription.findMany({ where: { messId }, orderBy: { createdAt: 'desc' }, take: BILLING_HISTORY_LIMIT });
    return { rows, ...resolveBilling(rows) };
  }

  /** Used by the global guard on every mess change (one indexed query). */
  async accessAllowed(messId: string): Promise<boolean> {
    return (await this.resolve(messId)).accessAllowed;
  }

  private toSummary(r: ReturnType<typeof resolveBilling>): PlatformBillingSummary {
    return {
      status: r.status,
      accessAllowed: r.accessAllowed,
      accessUntil: r.accessUntil,
      // Inclusive: the last day itself counts (ends today → 1 day remaining).
      daysRemaining: r.accessAllowed && r.accessUntil ? daysBetween(businessToday(), r.accessUntil) + 1 : null,
      current: r.current ? toRecord(r.current) : null,
      upcoming: r.upcoming.map(toRecord),
      support: this.config.support,
    };
  }

  async summary(messId: string): Promise<PlatformBillingSummary> {
    return this.toSummary(await this.resolve(messId));
  }

  async adminDetail(messId: string): Promise<AdminBillingDetail> {
    await this.assertMess(messId);
    const r = await this.resolve(messId);
    return {
      ...this.toSummary(r),
      history: r.rows.map((row) => ({ ...toRecord(row), phase: (row.id === r.current?.id ? 'CURRENT' : r.phase.get(row.id) === 'UPCOMING' ? 'UPCOMING' : 'PAST') as BillingRecordPhase })),
    };
  }

  /** Exactly 15 days from today. Never replaces a paid subscription that is still active. */
  async grantTrial(actorUserId: string, messId: string, notes?: string) {
    await this.assertMess(messId);
    const r = await this.resolve(messId);
    if (r.current?.status === 'ACTIVE' && r.accessAllowed) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'This mess already has an active paid subscription');
    }
    const today = businessToday();
    await this.prisma.platformSubscription.create({
      data: { messId, status: 'TRIAL', planName: 'Trial', trialStartDate: fromDateString(today), trialEndDate: fromDateString(addDays(today, PLATFORM_TRIAL_DAYS - 1)), notes: notes?.trim() || null, createdById: actorUserId },
    });
    await this.log(actorUserId, messId, AuditAction.BILLING_TRIAL_GRANTED, `${PLATFORM_TRIAL_DAYS}-day trial`);
    return this.adminDetail(messId);
  }

  /** Payment received outside the app: monthly/yearly period; a renewal continues after the current paid end. */
  async activate(actorUserId: string, messId: string, dto: { planName: string; billingCycle: BillingCycle; amountPaise: number; startDate?: string; endDate?: string; paymentReference?: string; notes?: string }) {
    await this.assertMess(messId);
    const r = await this.resolve(messId);
    // Renewal continues the day after the last paid day (current or already-booked upcoming), else starts today.
    const paidEnds = [r.current, ...r.upcoming].filter((x) => x?.status === 'ACTIVE' && (x === r.current ? r.accessAllowed : true)).map((x) => d(x!.endDate)!);
    const lastPaid = paidEnds.sort().at(-1);
    const start = dto.startDate ?? (lastPaid ? addDays(lastPaid, 1) : businessToday());
    // Inclusive end: monthly 10 Oct → 9 Nov, yearly 10 Oct 2026 → 9 Oct 2027.
    const end = dto.endDate ?? calculateEndDate(start, PlanDurationType.MONTHS, dto.billingCycle === BillingCycle.YEARLY ? 12 : 1);
    if (end < start) throw AppException.validation({ endDate: ['End date must be on or after the start date'] });
    await this.prisma.platformSubscription.create({
      data: {
        messId,
        status: 'ACTIVE',
        planName: dto.planName.trim(),
        billingCycle: dto.billingCycle,
        amountPaise: dto.amountPaise,
        startDate: fromDateString(start),
        endDate: fromDateString(end),
        paymentReference: dto.paymentReference?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: actorUserId,
      },
    });
    await this.log(actorUserId, messId, AuditAction.BILLING_ACTIVATED, `${dto.planName} ${dto.billingCycle} ${start} → ${end}${dto.paymentReference ? ` · ref ${dto.paymentReference}` : ''}`);
    return this.adminDetail(messId);
  }

  /** Mark expired or suspend MessMate access (data is never touched). */
  async setStatus(actorUserId: string, messId: string, status: 'EXPIRED' | 'SUSPENDED', notes?: string) {
    await this.assertMess(messId);
    const { current } = await this.resolve(messId);
    // A status row ends all earlier periods (current and upcoming); it carries no period of its own.
    await this.prisma.platformSubscription.create({
      data: { messId, status, planName: current?.planName ?? 'MessMate', billingCycle: current?.billingCycle ?? null, amountPaise: 0, notes: notes?.trim() || null, createdById: actorUserId },
    });
    await this.log(actorUserId, messId, AuditAction.BILLING_STATUS_CHANGED, `${status}${notes ? ` — ${notes}` : ''}`);
    return this.adminDetail(messId);
  }

  private async log(actorUserId: string, messId: string, action: AuditAction, reason: string) {
    const mess = await this.prisma.mess.findUnique({ where: { id: messId }, select: { name: true } });
    await this.audit.record({ actorUserId, action, targetType: AuditTargetType.MESS, targetId: messId, messId, reason: reason.slice(0, 500), label: mess?.name });
  }

  private async assertMess(messId: string) {
    if (!(await this.prisma.mess.count({ where: { id: messId } }))) throw AppException.notFound('Mess not found');
  }
}
