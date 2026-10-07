import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import {
  MEAL_PLAN_LIMITS,
  MealPlanStatus,
  PlanDurationType,
  type MealPlanInput,
  type MealPlanListQuery,
} from '@mess/shared';
import { Trim } from '../../../common/http/transforms';
import { OptionalText } from '../../../common/http/validators';

/** No property initializers: PartialType would copy them into updates and reset omitted fields. */
export class CreateMealPlanDto implements Omit<MealPlanInput, 'breakfastIncluded' | 'mealCredits'> {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  @MaxLength(MEAL_PLAN_LIMITS.nameMax)
  name: string;

  @OptionalText(MEAL_PLAN_LIMITS.descriptionMax)
  description: string | null;

  /** Rupees */
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, { message: 'Enter a valid price' })
  @Min(0, { message: 'Price cannot be negative' })
  @Max(MEAL_PLAN_LIMITS.priceMax)
  price: number;

  @IsOptional()
  @IsBoolean()
  breakfastIncluded?: boolean;

  @IsBoolean()
  lunchIncluded: boolean;

  @IsBoolean()
  dinnerIncluded: boolean;

  @IsEnum(PlanDurationType)
  durationType: PlanDurationType;

  @IsInt({ message: 'Enter a whole number' })
  @Min(1, { message: 'Duration must be at least 1' })
  @Max(MEAL_PLAN_LIMITS.daysMax)
  durationValue: number;

  /** Meals in a limited package; null/omitted = unlimited within validity */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt({ message: 'Enter a whole number of meals' })
  @Min(1, { message: 'Meal count must be at least 1' })
  @Max(MEAL_PLAN_LIMITS.mealCreditsMax)
  mealCredits?: number | null;
}

export class UpdateMealPlanDto extends PartialType(CreateMealPlanDto) {}

export class UpdateMealPlanStatusDto {
  @IsEnum(MealPlanStatus)
  status: MealPlanStatus;
}

export class ListMealPlansQueryDto implements MealPlanListQuery {
  @IsOptional()
  @IsIn(Object.values(MealPlanStatus))
  status?: MealPlanStatus;

  @IsOptional()
  @Trim()
  @MaxLength(80)
  search?: string;
}
