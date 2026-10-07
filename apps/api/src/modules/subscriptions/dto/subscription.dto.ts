import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';
import {
  PlanChangeMode,
  SubscriptionStatus,
  type AssignSubscriptionRequest,
  type ChangePlanRequest,
  type RenewSubscriptionRequest,
  type SubscriptionListQuery,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly } from '../../../common/http/validators';

export class AssignSubscriptionDto implements AssignSubscriptionRequest {
  @IsUUID('4', { message: 'Select a meal plan' })
  mealPlanId: string;

  @IsDateOnly()
  startDate: string;

  @IsOptional()
  @IsDateOnly()
  endDate?: string;
}

export class RenewSubscriptionDto implements RenewSubscriptionRequest {
  @IsOptional()
  @IsUUID('4', { message: 'Select a meal plan' })
  mealPlanId?: string;

  @IsOptional()
  @IsDateOnly()
  startDate?: string;

  @IsOptional()
  @IsDateOnly()
  endDate?: string;
}

export class ChangePlanDto implements ChangePlanRequest {
  @IsUUID('4', { message: 'Select a meal plan' })
  mealPlanId: string;

  @IsEnum(PlanChangeMode)
  mode: PlanChangeMode;
}

export class ListSubscriptionsQueryDto extends PaginationQueryDto implements SubscriptionListQuery {
  @IsOptional()
  @IsIn(Object.values(SubscriptionStatus))
  status?: SubscriptionStatus;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  mealPlanId?: string;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  expiringSoon?: boolean;
}
