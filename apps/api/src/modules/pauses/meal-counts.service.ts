import { Injectable } from '@nestjs/common';
import { AttendanceStatus, businessToday, MEAL_KEYS, type ExpectedMeals, type MealType } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { fromDateString } from '../../common/http/dates';

type CountRow = Record<`${MealType}_entitled` | `${MealType}_paused`, number>;

/**
 * Deterministic meal counts for a date:
 *   entitled = active students whose subscription valid that day includes the meal
 *   paused   = those of them with an active pause for that meal
 *   expected = entitled − paused        (what to cook for)
 *   served   = attendance actually served (kept separate; never mixed into "expected")
 */
@Injectable()
export class MealCountsService {
  constructor(private readonly prisma: PrismaService) {}

  async forDate(messId: string, date = businessToday()): Promise<ExpectedMeals> {
    const [rows, served] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
        SELECT
          count(*) FILTER (WHERE s."breakfastIncluded")::int AS breakfast_entitled,
          count(*) FILTER (WHERE s."breakfastIncluded" AND EXISTS (
            SELECT 1 FROM meal_pauses p WHERE p."studentId" = s."studentId" AND p."pauseDate" = ${date}::date
              AND p."mealType" = 'breakfast' AND p.status = 'ACTIVE'))::int AS breakfast_paused,
          count(*) FILTER (WHERE s."lunchIncluded")::int AS lunch_entitled,
          count(*) FILTER (WHERE s."lunchIncluded" AND EXISTS (
            SELECT 1 FROM meal_pauses p WHERE p."studentId" = s."studentId" AND p."pauseDate" = ${date}::date
              AND p."mealType" = 'lunch' AND p.status = 'ACTIVE'))::int AS lunch_paused,
          count(*) FILTER (WHERE s."dinnerIncluded")::int AS dinner_entitled,
          count(*) FILTER (WHERE s."dinnerIncluded" AND EXISTS (
            SELECT 1 FROM meal_pauses p WHERE p."studentId" = s."studentId" AND p."pauseDate" = ${date}::date
              AND p."mealType" = 'dinner' AND p.status = 'ACTIVE'))::int AS dinner_paused
        FROM student_subscriptions s
        JOIN mess_students st ON st.id = s."studentId"
        WHERE s."messId" = ${messId}::uuid
          AND s."cancelledAt" IS NULL
          AND s."startDate" <= ${date}::date AND s."endDate" >= ${date}::date
          AND st.status = 'ACTIVE'`,
      this.prisma.mealAttendance.groupBy({
        by: ['mealType'],
        where: { messId, attendanceDate: fromDateString(date), status: AttendanceStatus.SERVED },
        _count: { _all: true },
      }),
    ]);
    const row = rows[0];
    const meals = Object.fromEntries(
      MEAL_KEYS.map((meal) => {
        const entitled = row[`${meal}_entitled`];
        const paused = row[`${meal}_paused`];
        const expected = entitled - paused;
        const servedCount = served.find((g) => g.mealType === meal)?._count._all ?? 0;
        return [meal, { entitled, paused, expected, served: servedCount, remaining: Math.max(0, expected - servedCount) }];
      }),
    ) as ExpectedMeals['meals'];
    return { date, meals };
  }
}
