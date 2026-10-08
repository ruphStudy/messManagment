import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@mess/shared';
import {
  CurrentAuth,
  CurrentMessId,
  RequireMess,
  RequirePermissions,
  StudentOnly,
} from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { PaginationQueryDto } from '../../common/http/pagination';
import { UuidParam } from '../../common/http/params';
import { AttendanceService } from './attendance.service';
import { AttendanceDateQueryDto, ListAttendanceQueryDto, ManualAttendanceDto, ReverseAttendanceDto, ScanDto } from './dto/attendance.dto';

const actorOf = (auth: RequestAuth, messId: string) => ({ messId, userId: auth.user.id });

@ApiTags('attendance')
@Controller('attendance')
@RequireMess()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermissions(Permission.ATTENDANCE_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListAttendanceQueryDto) {
    return this.attendance.list(messId, query);
  }

  @Get('summary')
  @RequirePermissions(Permission.ATTENDANCE_VIEW)
  summary(@CurrentMessId() messId: string, @Query() query: AttendanceDateQueryDto) {
    return this.attendance.summary(messId, query.date);
  }

  /** Rejections (already served, no plan…) are returned as `{ outcome: 'REJECTED' }` with HTTP 200. */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  scan(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @Body() dto: ScanDto) {
    return this.attendance.scan(actorOf(auth, messId), dto);
  }

  @Post('manual')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_MARK)
  manual(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @Body() dto: ManualAttendanceDto) {
    return this.attendance.manual(actorOf(auth, messId), dto);
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_REVERSE)
  reverse(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @UuidParam('id', 'Attendance record') id: string, @Body() dto: ReverseAttendanceDto) {
    return this.attendance.reverse(actorOf(auth, messId), id, dto.reason);
  }
}

@ApiTags('attendance')
@Controller('students')
export class StudentAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('me/meal-qr')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mealQr(@CurrentAuth() auth: RequestAuth) {
    return this.attendance.mealQr(auth.user);
  }

  @Get('me/attendance')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  history(@CurrentAuth() auth: RequestAuth, @Query() query: PaginationQueryDto) {
    return this.attendance.studentHistory(auth.user, query);
  }
}
