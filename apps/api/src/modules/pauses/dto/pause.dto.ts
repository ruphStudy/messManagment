import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';
import {
  MEAL_KEYS,
  PAUSE_REASON_MAX,
  PauseStatus,
  StudentPauseView,
  type CreatePauseRequest,
  type MealType,
  type PauseListQuery,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

export class CreatePauseDto implements CreatePauseRequest {
  @IsDateOnly()
  fromDate: string;

  @IsDateOnly()
  toDate: string;

  @Transform(({ value }) => (Array.isArray(value) ? [...new Set(value)] : value))
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one meal' })
  @ArrayMaxSize(3)
  @IsIn(MEAL_KEYS, { each: true, message: 'Choose breakfast, lunch or dinner' })
  mealTypes: MealType[];

  @OptionalText(PAUSE_REASON_MAX)
  reason?: string;
}

export class ListPausesQueryDto extends PaginationQueryDto implements PauseListQuery {
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsIn(MEAL_KEYS)
  mealType?: MealType;

  @IsOptional()
  @IsIn(Object.values(PauseStatus))
  status?: PauseStatus;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;
}

export class PauseCalendarQueryDto {
  @IsDateOnly()
  from: string;

  @IsDateOnly()
  to: string;
}

export class StudentPausesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(StudentPauseView))
  view?: StudentPauseView;
}

export class DateQueryDto {
  @IsOptional()
  @IsDateOnly()
  date?: string;
}
