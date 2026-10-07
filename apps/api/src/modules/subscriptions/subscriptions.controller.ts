import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { can, Permission } from '@mess/shared';
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
import { AssignSubscriptionDto, ChangePlanDto, ListSubscriptionsQueryDto, RenewSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

const SubscriptionId = () => UuidParam('id', 'Subscription');
const StudentId = () => UuidParam('studentId', 'Student');

@ApiTags('subscriptions')
@Controller('subscriptions')
@RequireMess()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermissions(Permission.SUBSCRIPTION_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(messId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.SUBSCRIPTION_VIEW)
  get(@CurrentMessId() messId: string, @SubscriptionId() id: string) {
    return this.subscriptions.get(messId, id);
  }

  @Post(':id/renew')
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  renew(@CurrentMessId() messId: string, @SubscriptionId() id: string, @Body() dto: RenewSubscriptionDto) {
    return this.subscriptions.renew(messId, id, dto);
  }

  @Post(':id/change-plan')
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  changePlan(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @SubscriptionId() id: string, @Body() dto: ChangePlanDto) {
    return this.subscriptions.changePlan(messId, id, dto, can(auth.role, Permission.SUBSCRIPTION_CANCEL));
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.SUBSCRIPTION_CANCEL)
  cancel(@CurrentMessId() messId: string, @SubscriptionId() id: string) {
    return this.subscriptions.cancel(messId, id);
  }
}

/** Subscription routes nested under /students. `me/...` routes are declared before `:studentId/...`. */
@ApiTags('subscriptions')
@Controller('students')
export class StudentSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me/subscription')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mine(@CurrentAuth() auth: RequestAuth) {
    return this.subscriptions.getMine(auth.user);
  }

  @Get('me/subscriptions')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  myHistory(@CurrentAuth() auth: RequestAuth, @Query() query: PaginationQueryDto) {
    return this.subscriptions.listMine(auth.user, query);
  }

  @Get(':studentId/subscriptions')
  @RequireMess()
  @RequirePermissions(Permission.SUBSCRIPTION_VIEW)
  listForStudent(@CurrentMessId() messId: string, @StudentId() studentId: string) {
    return this.subscriptions.listForStudent(messId, studentId);
  }

  @Post(':studentId/subscriptions')
  @RequireMess()
  @RequirePermissions(Permission.SUBSCRIPTION_MANAGE)
  assign(@CurrentMessId() messId: string, @StudentId() studentId: string, @Body() dto: AssignSubscriptionDto) {
    return this.subscriptions.assign(messId, studentId, dto);
  }
}
