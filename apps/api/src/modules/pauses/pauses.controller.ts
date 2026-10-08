import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PauseSource } from '@prisma/client';
import { Permission } from '@mess/shared';
import {
  CurrentAuth,
  CurrentMessId,
  RequireMess,
  RequirePermissions,
  StudentOnly,
} from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { CreatePauseDto, DateQueryDto, ListPausesQueryDto, PauseCalendarQueryDto, StudentPausesQueryDto } from './dto/pause.dto';
import { MealCountsService } from './meal-counts.service';
import { PausesService } from './pauses.service';

const PauseId = () => UuidParam('id', 'Pause');

@ApiTags('pauses')
@Controller('pauses')
@RequireMess()
export class PausesController {
  constructor(private readonly pauses: PausesService) {}

  @Get()
  @RequirePermissions(Permission.PAUSE_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListPausesQueryDto) {
    return this.pauses.list(messId, query);
  }

  @Get('calendar')
  @RequirePermissions(Permission.PAUSE_VIEW)
  calendar(@CurrentMessId() messId: string, @Query() query: PauseCalendarQueryDto) {
    return this.pauses.calendar(messId, query.from, query.to);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PAUSE_MANAGE)
  cancel(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @PauseId() id: string) {
    return this.pauses.cancel(messId, auth.user.id, id);
  }
}

/** Expected vs served counts live next to attendance. */
@ApiTags('attendance')
@Controller('attendance')
@RequireMess()
export class ExpectedMealsController {
  constructor(private readonly counts: MealCountsService) {}

  @Get('expected')
  @RequirePermissions(Permission.ATTENDANCE_VIEW)
  expected(@CurrentMessId() messId: string, @Query() query: DateQueryDto) {
    return this.counts.forDate(messId, query.date);
  }
}

/** Student self-service (`me/...`) and mess-team pauses for one student. */
@ApiTags('pauses')
@Controller('students')
export class StudentPausesController {
  constructor(private readonly pauses: PausesService) {}

  @Get('me/pause-settings')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  settings(@CurrentAuth() auth: RequestAuth) {
    return this.pauses.settingsForSelf(auth.user);
  }

  @Get('me/pauses')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mine(@CurrentAuth() auth: RequestAuth, @Query() query: StudentPausesQueryDto) {
    return this.pauses.listForSelf(auth.user, query.view, query);
  }

  @Post('me/pauses')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  createMine(@CurrentAuth() auth: RequestAuth, @Body() dto: CreatePauseDto) {
    return this.pauses.createForSelf(auth.user, dto);
  }

  @Post('me/pauses/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  cancelMine(@CurrentAuth() auth: RequestAuth, @PauseId() id: string) {
    return this.pauses.cancelForSelf(auth.user, id);
  }

  @Post(':studentId/pauses')
  @RequireMess()
  @RequirePermissions(Permission.PAUSE_MANAGE)
  createForStudent(
    @CurrentAuth() auth: RequestAuth,
    @CurrentMessId() messId: string,
    @UuidParam('studentId', 'Student') studentId: string,
    @Body() dto: CreatePauseDto,
  ) {
    return this.pauses.create({ messId, studentId, userId: auth.user.id, source: PauseSource.MESS }, dto);
  }
}
