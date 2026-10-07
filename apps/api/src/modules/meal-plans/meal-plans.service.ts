import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type MealPlan as MealPlanRow } from '@prisma/client';
import {
  businessToday,
  ErrorCode,
  MEAL_PLAN_LIMITS,
  MealPlanStatus,
  PlanDurationType,
  type MealPlan,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString } from '../../common/http/dates';
import { CreateMealPlanDto, ListMealPlansQueryDto, UpdateMealPlanDto } from './dto/meal-plan.dto';

type PlanFields = Pick<MealPlanRow, 'breakfastIncluded' | 'lunchIncluded' | 'dinnerIncluded' | 'durationType' | 'durationValue'>;

const toPaise = (rupees: number) => Math.round(rupees * 100);

/** Mess-scoped meal plans. Every query filters by messId from the caller's membership. */
@Injectable()
export class MealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(messId: string, query: ListMealPlansQueryDto): Promise<MealPlan[]> {
    const plans = await this.prisma.mealPlan.findMany({
      where: {
        messId,
        status: query.status,
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: this.countInclude(),
      orderBy: [{ status: 'asc' }, { pricePaise: 'asc' }, { name: 'asc' }],
    });
    return plans.map((p) => this.toDto(p));
  }

  async get(messId: string, id: string): Promise<MealPlan> {
    const plan = await this.prisma.mealPlan.findFirst({ where: { id, messId }, include: this.countInclude() });
    if (!plan) throw this.notFound();
    return this.toDto(plan);
  }

  async create(messId: string, dto: CreateMealPlanDto): Promise<MealPlan> {
    const { price, breakfastIncluded = false, mealCredits = null, ...fields } = dto;
    this.assertRules({ ...fields, breakfastIncluded });
    await this.assertNameAvailable(messId, dto.name);
    const plan = await this.prisma.mealPlan.create({
      data: { ...fields, breakfastIncluded, mealCredits, pricePaise: toPaise(price), messId },
      include: this.countInclude(),
    });
    return this.toDto(plan);
  }

  /** Edits apply to future assignments only; existing subscriptions keep their snapshot. */
  async update(messId: string, id: string, dto: UpdateMealPlanDto): Promise<MealPlan> {
    const current = await this.prisma.mealPlan.findFirst({ where: { id, messId } });
    if (!current) throw this.notFound();
    this.assertRules({ ...current, ...dto });
    if (dto.name && current.status === MealPlanStatus.ACTIVE) await this.assertNameAvailable(messId, dto.name, id);

    const { price, ...fields } = dto;
    const plan = await this.prisma.mealPlan.update({
      where: { id, messId },
      data: { ...fields, ...(price !== undefined ? { pricePaise: toPaise(price) } : {}) },
      include: this.countInclude(),
    });
    return this.toDto(plan);
  }

  /** Deactivated plans cannot be newly assigned; existing subscriptions are untouched. */
  async setStatus(messId: string, id: string, status: MealPlanStatus): Promise<MealPlan> {
    const current = await this.prisma.mealPlan.findFirst({ where: { id, messId }, select: { name: true } });
    if (!current) throw this.notFound();
    if (status === MealPlanStatus.ACTIVE) await this.assertNameAvailable(messId, current.name, id);
    const plan = await this.prisma.mealPlan.update({ where: { id, messId }, data: { status }, include: this.countInclude() });
    return this.toDto(plan);
  }

  /** Loads a plan of this mess that may be assigned right now. */
  async requireAssignable(messId: string, id: string, db: Prisma.TransactionClient = this.prisma): Promise<MealPlanRow> {
    const plan = await db.mealPlan.findFirst({ where: { id, messId } });
    if (!plan) throw this.notFound();
    if (plan.status !== MealPlanStatus.ACTIVE) {
      throw AppException.conflict(`"${plan.name}" is inactive and cannot be assigned`, { mealPlanId: ['This plan is inactive'] }, ErrorCode.PLAN_INACTIVE);
    }
    return plan;
  }

  private assertRules(plan: PlanFields) {
    const fields: Record<string, string[]> = {};
    if (!plan.breakfastIncluded && !plan.lunchIncluded && !plan.dinnerIncluded) fields.meals = ['Select at least one meal'];
    if (plan.durationType === PlanDurationType.MONTHS && plan.durationValue > MEAL_PLAN_LIMITS.monthsMax) {
      fields.durationValue = [`A plan can be at most ${MEAL_PLAN_LIMITS.monthsMax} months`];
    }
    if (Object.keys(fields).length) throw AppException.validation(fields);
  }

  /** Active plan names must be unique within a mess (case-insensitive). */
  private async assertNameAvailable(messId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.mealPlan.findFirst({
      where: { messId, status: MealPlanStatus.ACTIVE, name: { equals: name, mode: 'insensitive' }, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (clash) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.PLAN_NAME_TAKEN, 'An active plan with this name already exists', {
        name: ['Choose a different name'],
      });
    }
  }

  /** Counts active + upcoming subscriptions in the same query (no N+1). */
  private countInclude() {
    return {
      _count: {
        select: { subscriptions: { where: { cancelledAt: null, endDate: { gte: fromDateString(businessToday()) } } } },
      },
    } satisfies Prisma.MealPlanInclude;
  }

  private toDto(plan: MealPlanRow & { _count: { subscriptions: number } }): MealPlan {
    const { messId: _messId, pricePaise, _count, createdAt, updatedAt, ...rest } = plan;
    return {
      ...rest,
      price: pricePaise / 100,
      currentSubscriptionCount: _count.subscriptions,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  private notFound() {
    return AppException.notFound('Meal plan not found');
  }
}
