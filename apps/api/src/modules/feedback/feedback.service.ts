import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceStatus, FeedbackType, Prisma, type User } from '@prisma/client';
import {
  addDays,
  businessToday,
  ErrorCode,
  FEEDBACK_WINDOW_DAYS,
  isFeedbackWindowOpen,
  RATING_DIMENSIONS,
  type EligibleMeal,
  type FeedbackItem,
  type RatingSummary,
  type StudentFeedbackItem,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { StudentsService } from '../students/students.service';
import { studentSearchTerms } from '../students/student-search';
import { GeneralFeedbackDto, ListFeedbackQueryDto, MealFeedbackDto } from './dto/feedback.dto';

const feedbackInclude = {
  student: { select: { id: true, firstName: true, lastName: true, mobile: true } },
  attendance: { select: { status: true } },
} as const;
type Row = Prisma.FeedbackGetPayload<{ include: typeof feedbackInclude }>;

function toStudentItem(row: Omit<Row, 'student' | 'attendance'>): StudentFeedbackItem {
  return {
    id: row.id,
    type: row.type,
    date: toDateString(row.feedbackDate),
    mealType: row.mealType,
    overallRating: row.overallRating,
    tasteRating: row.tasteRating,
    qualityRating: row.qualityRating,
    quantityRating: row.quantityRating,
    cleanlinessRating: row.cleanlinessRating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

const toItem = (row: Row): FeedbackItem => ({
  ...toStudentItem(row),
  student: row.student,
  mealReversed: row.attendance?.status === AttendanceStatus.REVERSED,
});

/**
 * Ratings and general feedback. Meal feedback needs a real SERVED attendance of the student, within
 * FEEDBACK_WINDOW_DAYS, at most once. Policy for later reversals: the feedback stays in history (flagged)
 * but is excluded from rating averages.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  async eligibleMeals(user: User): Promise<EligibleMeal[]> {
    const student = await this.students.resolveSelf(user);
    if (!student) return [];
    const today = businessToday();
    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        studentId: student.id,
        messId: student.messId,
        status: AttendanceStatus.SERVED,
        feedback: null,
        attendanceDate: { gte: fromDateString(addDays(today, -FEEDBACK_WINDOW_DAYS)), lte: fromDateString(today) },
      },
      include: { subscription: { select: { planName: true } } },
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => ({ attendanceId: r.id, date: toDateString(r.attendanceDate), mealType: r.mealType, planName: r.subscription.planName }));
  }

  async submitMeal(user: User, dto: MealFeedbackDto): Promise<StudentFeedbackItem> {
    const student = await this.requireSelf(user);
    const attendance = await this.prisma.mealAttendance.findFirst({
      where: { id: dto.attendanceId, studentId: student.id, messId: student.messId },
      select: { id: true, status: true, attendanceDate: true, mealType: true, feedback: { select: { id: true } } },
    });
    // Unknown, another student's, or reversed: the same answer, so nothing leaks.
    if (!attendance || attendance.status !== AttendanceStatus.SERVED) throw this.notAllowed('You can only rate meals you were served');
    if (!isFeedbackWindowOpen(toDateString(attendance.attendanceDate), businessToday())) {
      throw this.notAllowed(`Meals can be rated within ${FEEDBACK_WINDOW_DAYS} days`);
    }
    if (attendance.feedback) throw this.alreadySubmitted();

    try {
      const row = await this.prisma.feedback.create({
        data: {
          messId: student.messId,
          studentId: student.id,
          type: FeedbackType.MEAL,
          attendanceId: attendance.id,
          feedbackDate: attendance.attendanceDate,
          mealType: attendance.mealType,
          overallRating: dto.overallRating,
          tasteRating: dto.tasteRating ?? null,
          qualityRating: dto.qualityRating ?? null,
          quantityRating: dto.quantityRating ?? null,
          cleanlinessRating: dto.cleanlinessRating ?? null,
          comment: dto.comment ?? null,
        },
      });
      return toStudentItem(row);
    } catch (error) {
      // Two simultaneous submits for the same meal: the unique attendanceId keeps only one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw this.alreadySubmitted();
      throw error;
    }
  }

  async submitGeneral(user: User, dto: GeneralFeedbackDto): Promise<StudentFeedbackItem> {
    if (dto.overallRating === undefined && !dto.comment) {
      throw AppException.validation({ comment: ['Add a rating or a comment'] }, 'Add a rating or a comment');
    }
    const student = await this.requireSelf(user);
    const row = await this.prisma.feedback.create({
      data: {
        messId: student.messId,
        studentId: student.id,
        type: FeedbackType.GENERAL,
        feedbackDate: fromDateString(businessToday()),
        overallRating: dto.overallRating ?? null,
        comment: dto.comment ?? null,
      },
    });
    return toStudentItem(row);
  }

  async listMine(user: User, query: PaginationQueryDto) {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const where = { studentId: student.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.feedback.count({ where }),
    ]);
    return new Paginated(rows.map(toStudentItem), total, query);
  }

  async list(messId: string, query: ListFeedbackQueryDto) {
    const where: Prisma.FeedbackWhereInput = {
      messId,
      type: query.type,
      mealType: query.mealType,
      overallRating: query.rating,
      feedbackDate: { ...(query.from ? { gte: fromDateString(query.from) } : {}), ...(query.to ? { lte: fromDateString(query.to) } : {}) },
      ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({ where, include: feedbackInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.feedback.count({ where }),
    ]);
    return new Paginated(rows.map(toItem), total, query);
  }

  /** Averages in SQL. Meal feedback on meals later reversed is excluded. */
  async summary(messId: string, from: string, to: string): Promise<RatingSummary> {
    const [meal] = await this.prisma.$queryRaw<
      { count: number; overall: number | null; taste: number | null; quality: number | null; quantity: number | null; cleanliness: number | null }[]
    >`
      SELECT count(*)::int AS count,
        round(avg(f."overallRating"), 1)::float AS overall,
        round(avg(f."tasteRating"), 1)::float AS taste,
        round(avg(f."qualityRating"), 1)::float AS quality,
        round(avg(f."quantityRating"), 1)::float AS quantity,
        round(avg(f."cleanlinessRating"), 1)::float AS cleanliness
      FROM feedback f JOIN meal_attendance a ON a.id = f."attendanceId"
      WHERE f."messId" = ${messId}::uuid AND f.type = 'MEAL' AND a.status = 'SERVED'
        AND f."feedbackDate" BETWEEN ${from}::date AND ${to}::date`;
    const [general] = await this.prisma.$queryRaw<{ count: number; average: number | null }[]>`
      SELECT count(*)::int AS count, round(avg("overallRating"), 1)::float AS average
      FROM feedback
      WHERE "messId" = ${messId}::uuid AND type = 'GENERAL' AND "feedbackDate" BETWEEN ${from}::date AND ${to}::date`;
    return {
      from,
      to,
      mealCount: meal.count,
      averages: Object.fromEntries(RATING_DIMENSIONS.map((d) => [d, meal[d]])) as RatingSummary['averages'],
      generalCount: general.count,
      generalAverage: general.average,
    };
  }

  private async requireSelf(user: User) {
    const student = await this.students.resolveSelf(user);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not linked your mobile number yet');
    return student;
  }

  private notAllowed(message: string) {
    return new AppException(HttpStatus.FORBIDDEN, ErrorCode.FEEDBACK_NOT_ALLOWED, message);
  }

  private alreadySubmitted() {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.FEEDBACK_ALREADY_SUBMITTED, 'You already rated this meal');
  }
}
