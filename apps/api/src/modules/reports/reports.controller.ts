import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Permission, REPORT_PERMISSIONS, ReportType } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { ListAttendanceQueryDto } from '../attendance/dto/attendance.dto';
import { ListComplaintsQueryDto } from '../complaints/dto/complaint.dto';
import { ListExpensesQueryDto } from '../expenses/dto/expense.dto';
import { ListFeedbackQueryDto } from '../feedback/dto/feedback.dto';
import { ListPausesQueryDto } from '../pauses/dto/pause.dto';
import { DuesQueryDto, ListPaymentsQueryDto } from '../payments/dto/payment.dto';
import { ListStudentsQueryDto } from '../students/dto/student.dto';
import { ListSubscriptionsQueryDto } from '../subscriptions/dto/subscription.dto';
import { ReportsService } from './reports.service';

const EXPORT_LIMIT = { default: { limit: 10, ttl: 60_000 } };

/**
 * Each report has a JSON view and a CSV export with the SAME query DTO, permission and tenant scope,
 * so an export always matches what is on screen. Permissions come from REPORT_PERMISSIONS.
 */
@ApiTags('reports')
@Controller('reports')
@RequireMess()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private async send(res: Response, type: ReportType, auth: RequestAuth, messId: string, query: object) {
    const { csv, filename } = await this.reports.export(type, messId, auth.user.id, query as never);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
    res.send(csv);
  }

  @Get('students') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.students)
  students(@CurrentMessId() m: string, @Query() q: ListStudentsQueryDto) { return this.reports.run('students', m, q); }

  @Get('students/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.students)
  studentsCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListStudentsQueryDto, @Res() res: Response) { return this.send(res, 'students', a, m, q); }

  @Get('attendance') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.attendance)
  attendance(@CurrentMessId() m: string, @Query() q: ListAttendanceQueryDto) { return this.reports.run('attendance', m, q); }

  @Get('attendance/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.attendance)
  attendanceCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListAttendanceQueryDto, @Res() res: Response) { return this.send(res, 'attendance', a, m, q); }

  @Get('pauses') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.pauses)
  pauses(@CurrentMessId() m: string, @Query() q: ListPausesQueryDto) { return this.reports.run('pauses', m, q); }

  @Get('pauses/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.pauses)
  pausesCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListPausesQueryDto, @Res() res: Response) { return this.send(res, 'pauses', a, m, q); }

  @Get('subscriptions') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.subscriptions)
  subscriptions(@CurrentMessId() m: string, @Query() q: ListSubscriptionsQueryDto) { return this.reports.run('subscriptions', m, q); }

  @Get('subscriptions/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.subscriptions)
  subscriptionsCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListSubscriptionsQueryDto, @Res() res: Response) { return this.send(res, 'subscriptions', a, m, q); }

  @Get('payments') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.payments)
  payments(@CurrentMessId() m: string, @Query() q: ListPaymentsQueryDto) { return this.reports.run('payments', m, q); }

  @Get('payments/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.payments)
  paymentsCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListPaymentsQueryDto, @Res() res: Response) { return this.send(res, 'payments', a, m, q); }

  @Get('dues') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.dues)
  dues(@CurrentMessId() m: string, @Query() q: DuesQueryDto) { return this.reports.run('dues', m, q); }

  @Get('dues/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.dues)
  duesCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: DuesQueryDto, @Res() res: Response) { return this.send(res, 'dues', a, m, q); }

  @Get('expenses') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.expenses)
  expenses(@CurrentMessId() m: string, @Query() q: ListExpensesQueryDto) { return this.reports.run('expenses', m, q); }

  @Get('expenses/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.expenses)
  expensesCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListExpensesQueryDto, @Res() res: Response) { return this.send(res, 'expenses', a, m, q); }

  @Get('feedback') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.feedback)
  feedback(@CurrentMessId() m: string, @Query() q: ListFeedbackQueryDto) { return this.reports.run('feedback', m, q); }

  @Get('feedback/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.feedback)
  feedbackCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListFeedbackQueryDto, @Res() res: Response) { return this.send(res, 'feedback', a, m, q); }

  @Get('complaints') @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.complaints)
  complaints(@CurrentMessId() m: string, @Query() q: ListComplaintsQueryDto) { return this.reports.run('complaints', m, q); }

  @Get('complaints/export') @Throttle(EXPORT_LIMIT) @RequirePermissions(Permission.REPORTS_VIEW, REPORT_PERMISSIONS.complaints)
  complaintsCsv(@CurrentAuth() a: RequestAuth, @CurrentMessId() m: string, @Query() q: ListComplaintsQueryDto, @Res() res: Response) { return this.send(res, 'complaints', a, m, q); }
}
