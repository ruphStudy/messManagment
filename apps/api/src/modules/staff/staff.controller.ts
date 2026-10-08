import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import { UuidParam } from '../../common/http/params';
import type { RequestAuth } from '../../common/auth.types';
import { CreateStaffDto, ListStaffQueryDto, ResetStaffPasswordDto, SetStaffStatusDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

const StaffParam = () => UuidParam('id', 'Team member');

/** Team management for the caller's own mess. Writes are blocked for suspended messes by the global guard. */
@ApiTags('staff')
@RequireMess()
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_VIEW)
  list(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @Query() q: ListStaffQueryDto) {
    return this.staff.list(messId, auth, q);
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_VIEW)
  detail(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @StaffParam() id: string) {
    return this.staff.detail(messId, auth, id);
  }

  @Post()
  @RequirePermissions(Permission.STAFF_MANAGE)
  create(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @Body() dto: CreateStaffDto) {
    return this.staff.create(messId, auth, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.STAFF_MANAGE)
  update(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @StaffParam() id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(messId, auth, id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.STAFF_MANAGE)
  setStatus(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @StaffParam() id: string, @Body() dto: SetStaffStatusDto) {
    return this.staff.setStatus(messId, auth, id, dto.status);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(Permission.STAFF_MANAGE)
  resetPassword(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @StaffParam() id: string, @Body() dto: ResetStaffPasswordDto) {
    return this.staff.resetPassword(messId, auth, id, dto);
  }
}
