import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  businessToday,
  daysBetween,
  ErrorCode,
  REPORT_COLUMNS,
  REPORT_LIMITS,
  reportCsvHeader,
  reportCsvValue,
  ReportType,
  subscriptionStatus,
  toCsv,
  type ReportColumn,
  type StudentListItem,
  type StudentReportRow,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { toDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { AttendanceService } from '../attendance/attendance.service';
import { ComplaintsService } from '../complaints/complaints.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FeedbackService } from '../feedback/feedback.service';
import { PausesService } from '../pauses/pauses.service';
import { PaymentsService } from '../payments/payments.service';
import { StudentsService } from '../students/students.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

type Query = PaginationQueryDto & { from?: string; to?: string; joinedFrom?: string; joinedTo?: string };

interface ReportDefinition<Row = never> {
  /** Existing module list query (same filters, tenant scope and sorting as the normal screens). */
  page(messId: string, query: Query): Promise<Paginated<Row>>;
  /** Totals over the whole filtered set. */
  summary?(messId: string, query: Query): Promise<unknown>;
}


/**
 * Predefined reports. Rows come from the existing module list queries; this service only adds totals,
 * a date-range guard, and CSV export (same filters, same permissions, row limit, formula-safe cells).
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly definitions: Record<ReportType, ReportDefinition<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(
    private readonly prisma: PrismaService,
    students: StudentsService,
    attendance: AttendanceService,
    pauses: PausesService,
    subscriptions: SubscriptionsService,
    payments: PaymentsService,
    expenses: ExpensesService,
    feedback: FeedbackService,
    complaints: ComplaintsService,
  ) {
    this.definitions = {
      students: {
        page: async (messId, q) => this.withCurrentPlans(await students.list(messId, q as never)),
      },
      attendance: {
        page: (messId, q) => attendance.list(messId, q as never),
        summary: (messId, q) => attendance.servedCounts(messId, q as never),
      },
      pauses: {
        page: (messId, q) => pauses.list(messId, q as never),
        summary: (messId, q) => pauses.listSummary(messId, q as never),
      },
      subscriptions: {
        page: (messId, q) => subscriptions.list(messId, q as never),
      },
      payments: {
        page: (messId, q) => payments.list(messId, q as never),
        summary: (messId, q) => payments.collectedTotal(messId, q as never),
      },
      dues: {
        page: (messId, q) => payments.dues(messId, q as never),
        summary: (messId, q) => payments.duesTotals(messId, q as never),
      },
      expenses: {
        page: (messId, q) => expenses.list(messId, q as never),
        summary: (messId, q) => expenses.recordedTotal(messId, q as never),
      },
      feedback: {
        page: (messId, q) => feedback.list(messId, q as never),
        // Same averages as the Feedback page (reversed meals excluded).
        summary: (messId, q) => feedback.summary(messId, q.from ?? addDays(q.to ?? businessToday(), -(REPORT_LIMITS.maxRangeDays - 1)), q.to ?? businessToday()),
      },
      complaints: {
        page: (messId, q) => complaints.list(messId, q as never),
        summary: (messId, q) => complaints.counts(messId, q as never),
      },
    };
  }

  async run(type: ReportType, messId: string, query: Query) {
    this.assertRange(query);
    const def = this.definitions[type];
    const [page, summary] = await Promise.all([def.page(messId, query), def.summary?.(messId, query)]);
    page.summary = summary;
    return page;
  }

  /** Full filtered set as CSV (refused above REPORT_LIMITS.exportMaxRows). */
  async export(type: ReportType, messId: string, userId: string, query: Query) {
    this.assertRange(query);
    const def = this.definitions[type];
    const probe = await def.page(messId, this.withPage(query, 1));
    const total = probe.meta.total;
    if (total > REPORT_LIMITS.exportMaxRows) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EXPORT_TOO_LARGE,
        `This export has ${total.toLocaleString('en-IN')} rows. Narrow the filters to at most ${REPORT_LIMITS.exportMaxRows.toLocaleString('en-IN')} rows.`,
      );
    }
    const rows = total ? (await def.page(messId, this.withPage(query, total))).items : [];
    const columns = REPORT_COLUMNS[type] as ReportColumn<unknown>[];
    const csv = toCsv(
      columns.map(reportCsvHeader),
      rows.map((row) => columns.map((column) => reportCsvValue(column, row))),
    );
    this.logger.log(`Export ${type}: ${rows.length} rows by user ${userId}`);
    return { csv, filename: this.filename(type, query) };
  }

  /** e.g. attendance-2026-10-01-to-2026-10-31.csv, payments-2026-10.csv, students-2026-10-09.csv */
  private filename(type: ReportType, q: Query) {
    const from = q.from ?? q.joinedFrom;
    const to = q.to ?? q.joinedTo;
    if (from && to) {
      const [y, m] = from.split('-').map(Number);
      const monthEnd = toDateString(new Date(Date.UTC(y, m, 0)));
      if (from.endsWith('-01') && to === monthEnd) return `${type}-${from.slice(0, 7)}.csv`;
      return from === to ? `${type}-${from}.csv` : `${type}-${from}-to-${to}.csv`;
    }
    return `${type}-${businessToday()}.csv`;
  }

  private assertRange(q: Query) {
    for (const [from, to] of [[q.from, q.to], [q.joinedFrom, q.joinedTo]]) {
      if (!from || !to) continue;
      const span = daysBetween(from, to) + 1;
      if (span < 1) throw AppException.validation({ to: ['"To" must be on or after "From"'] });
      if (span > REPORT_LIMITS.maxRangeDays) {
        throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.REPORT_RANGE_TOO_LARGE, `Choose at most ${REPORT_LIMITS.maxRangeDays} days`, {
          to: [`Choose at most ${REPORT_LIMITS.maxRangeDays} days`],
        });
      }
    }
  }

  /** Same filters, different page window (keeps the DTO prototype so `skip` still works). */
  private withPage<Q extends Query>(query: Q, pageSize: number): Q {
    return Object.assign(Object.create(Object.getPrototypeOf(query)), query, { page: 1, pageSize });
  }

  /** Adds each student's current plan (active, else upcoming, else most recent) in one query per page. */
  private async withCurrentPlans(page: Paginated<StudentListItem>): Promise<Paginated<StudentReportRow>> {
    const today = businessToday();
    const subs = await this.prisma.studentSubscription.findMany({
      where: { studentId: { in: page.items.map((s) => s.id) }, cancelledAt: null },
      select: { studentId: true, planName: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    });
    const rank = { ACTIVE: 0, UPCOMING: 1, EXPIRED: 2, CANCELLED: 3 } as const;
    const best = new Map<string, StudentReportRow['currentPlan']>();
    for (const s of subs) {
      const startDate = toDateString(s.startDate);
      const endDate = toDateString(s.endDate);
      const status = subscriptionStatus({ startDate, endDate, cancelledAt: null }, today);
      const current = best.get(s.studentId);
      if (!current || rank[status] < rank[current.status]) best.set(s.studentId, { name: s.planName, status, endDate });
    }
    const rows = page.items.map((s) => ({ ...s, currentPlan: best.get(s.id) ?? null }));
    const result = new Paginated(rows, page.meta.total, { page: page.meta.page, pageSize: page.meta.pageSize } as PaginationQueryDto);
    return result;
  }
}
