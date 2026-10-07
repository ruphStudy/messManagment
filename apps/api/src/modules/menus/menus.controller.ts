import { Body, Controller, Get, Param, ParseEnumPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, StudentMenuRange } from '@mess/shared';
import {
  CurrentAuth,
  CurrentMessId,
  RequireMess,
  RequirePermissions,
  StudentOnly,
} from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { AppException } from '../../common/http/app.exception';
import { DateParam } from '../../common/http/date-param.pipe';
import { CopyMenuDto, CopyWeekDto, DailyMenuDto, MenuRangeQueryDto } from './dto/menu.dto';
import { MenusService } from './menus.service';

@ApiTags('menus')
@Controller('menus')
@RequireMess()
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @RequirePermissions(Permission.MENU_VIEW)
  range(@CurrentMessId() messId: string, @Query() query: MenuRangeQueryDto) {
    return this.menus.range(messId, query.from, query.to);
  }

  @Post('copy-week')
  @RequirePermissions(Permission.MENU_MANAGE)
  copyWeek(@CurrentMessId() messId: string, @Body() dto: CopyWeekDto) {
    return this.menus.copyWeek(messId, dto);
  }

  @Get(':date')
  @RequirePermissions(Permission.MENU_VIEW)
  getDay(@CurrentMessId() messId: string, @DateParam() date: string) {
    return this.menus.getDay(messId, date);
  }

  @Put(':date')
  @RequirePermissions(Permission.MENU_MANAGE)
  save(@CurrentMessId() messId: string, @DateParam() date: string, @Body() dto: DailyMenuDto) {
    return this.menus.save(messId, date, dto);
  }

  @Post(':date/publish')
  @RequirePermissions(Permission.MENU_MANAGE)
  publish(@CurrentMessId() messId: string, @DateParam() date: string) {
    return this.menus.setPublished(messId, date, true);
  }

  @Post(':date/unpublish')
  @RequirePermissions(Permission.MENU_MANAGE)
  unpublish(@CurrentMessId() messId: string, @DateParam() date: string) {
    return this.menus.setPublished(messId, date, false);
  }

  @Post(':date/copy-from')
  @RequirePermissions(Permission.MENU_MANAGE)
  copyFrom(@CurrentMessId() messId: string, @DateParam() date: string, @Body() dto: CopyMenuDto) {
    return this.menus.copyDay(messId, date, dto);
  }
}

@ApiTags('menus')
@Controller('students')
export class StudentMenuController {
  constructor(private readonly menus: MenusService) {}

  /** GET /students/me/menu/today | tomorrow | week */
  @Get('me/menu/:range')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mine(
    @CurrentAuth() auth: RequestAuth,
    @Param('range', new ParseEnumPipe(StudentMenuRange, { exceptionFactory: () => AppException.notFound('Use today, tomorrow or week') }))
    range: StudentMenuRange,
  ) {
    return this.menus.forStudent(auth.user, range);
  }
}
