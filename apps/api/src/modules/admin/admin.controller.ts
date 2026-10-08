import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ADMIN_RECORD_TYPES, type AdminRecordType } from '@mess/shared';
import { AdminOnly, CurrentAuth } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/http/app.exception';
import { UuidParam } from '../../common/http/params';
import type { RequestAuth } from '../../common/auth.types';
import { AuditService } from '../audit/audit.service';
import { ComplaintsService } from '../complaints/complaints.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMessesService } from './admin-messes.service';
import { AdminSystemService } from './admin-system.service';
import { AdminUsersService } from './admin-users.service';
import {
  AdminComplaintsQueryDto,
  AdminMessListQueryDto,
  AdminRecordsQueryDto,
  AdminUserListQueryDto,
  AuditListQueryDto,
  ReactivateDto,
  SuspendDto,
} from './dto/admin.dto';

/**
 * Platform admin API. Every route requires the PLATFORM_ADMIN role and PLATFORM_ADMIN_ACCESS permission
 * (class-level). These are the only routes that read across messes; tenant routes are unchanged.
 */
@ApiTags('admin')
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly messes: AdminMessesService,
    private readonly users: AdminUsersService,
    private readonly complaints: ComplaintsService,
    private readonly audit: AuditService,
    private readonly system: AdminSystemService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.dashboardService.overview();
  }

  // ── Messes ──

  @Get('messes')
  listMesses(@Query() q: AdminMessListQueryDto) {
    return this.messes.list(q);
  }

  @Get('messes/:id')
  mess(@UuidParam('id', 'Mess') id: string) {
    return this.messes.detail(id);
  }

  @Get('messes/:id/records/:type')
  records(
    @UuidParam('id', 'Mess') id: string,
    @Param('type', new ParseEnumPipe(Object.fromEntries(ADMIN_RECORD_TYPES.map((t) => [t, t])), { exceptionFactory: () => AppException.notFound('Not found') }))
    type: AdminRecordType,
    @Query() q: AdminRecordsQueryDto,
  ) {
    return this.messes.records(id, type, q);
  }

  @Post('messes/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspendMess(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Mess') id: string, @Body() dto: SuspendDto) {
    return this.messes.suspend(auth.user.id, id, dto.reason);
  }

  @Post('messes/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateMess(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Mess') id: string, @Body() dto: ReactivateDto) {
    return this.messes.reactivate(auth.user.id, id, dto.reason);
  }

  // ── Users ──

  @Get('users')
  listUsers(@Query() q: AdminUserListQueryDto) {
    return this.users.list(q);
  }

  @Get('users/:id')
  user(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'User') id: string) {
    return this.users.detail(auth.user.id, id);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspendUser(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'User') id: string, @Body() dto: SuspendDto) {
    return this.users.suspend(auth.user.id, id, dto.reason);
  }

  @Post('users/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateUser(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'User') id: string, @Body() dto: ReactivateDto) {
    return this.users.reactivate(auth.user.id, id, dto.reason);
  }

  // ── Complaints (read-only) ──

  @Get('complaints')
  listComplaints(@Query() q: AdminComplaintsQueryDto) {
    return this.complaints.listForPlatform(q);
  }

  @Get('complaints/:id')
  complaint(@UuidParam('id', 'Complaint') id: string) {
    return this.complaints.detailForPlatform(id);
  }

  // ── Audit & system ──

  @Get('audit')
  auditLog(@Query() q: AuditListQueryDto) {
    return this.audit.list(q, q);
  }

  @Get('system')
  systemStatus() {
    return this.system.status();
  }
}
