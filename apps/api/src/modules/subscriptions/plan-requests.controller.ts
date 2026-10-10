import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Permission, PlanRequestStatus } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions, StudentOnly } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { Trim } from '../../common/http/transforms';
import { PlanRequestsService } from './plan-requests.service';

class CreatePlanRequestDto {
  @IsUUID()
  mealPlanId: string;
}
class RejectPlanRequestDto {
  @IsOptional() @Trim() @IsString() @MaxLength(200) reason?: string;
}
class ListPlanRequestsQueryDto {
  @IsOptional() @IsIn(Object.values(PlanRequestStatus)) status?: PlanRequestStatus;
}

const RequestId = () => UuidParam('id', 'Plan request');

/** Owner/manager: review students' plan choices. Approve = normal subscription assignment rules. */
@ApiTags('plan-requests')
@RequireMess()
@Controller('plan-requests')
export class PlanRequestsController {
  constructor(private readonly requests: PlanRequestsService) {}

  @Get()
  @RequirePermissions(Permission.SUBSCRIPTION_VIEW)
  list(@CurrentMessId() messId: string, @Query() q: ListPlanRequestsQueryDto) {
    return this.requests.list(messId, q.status);
  }

  @Get('count')
  @RequirePermissions(Permission.SUBSCRIPTION_VIEW)
  count(@CurrentMessId() messId: string) {
    return this.requests.pendingCount(messId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  approve(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @RequestId() id: string) {
    return this.requests.approve(messId, auth.user.id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  reject(@CurrentMessId() messId: string, @CurrentAuth() auth: RequestAuth, @RequestId() id: string, @Body() dto: RejectPlanRequestDto) {
    return this.requests.reject(messId, auth.user.id, id, dto.reason);
  }
}

/** Student: browse the selected mess's active plans and request one (never self-activates). */
@ApiTags('plan-requests')
@Controller('students/me')
export class StudentPlanRequestsController {
  constructor(private readonly requests: PlanRequestsService) {}

  @Get('plans')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  plans(@CurrentAuth() auth: RequestAuth) {
    return this.requests.availablePlans(auth.user);
  }

  @Get('plan-requests')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mine(@CurrentAuth() auth: RequestAuth) {
    return this.requests.myRequests(auth.user);
  }

  @Post('plan-requests')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  create(@CurrentAuth() auth: RequestAuth, @Body() dto: CreatePlanRequestDto) {
    return this.requests.request(auth.user, dto.mealPlanId);
  }

  @Post('plan-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  withdraw(@CurrentAuth() auth: RequestAuth, @RequestId() id: string) {
    return this.requests.withdraw(auth.user, id);
  }
}
