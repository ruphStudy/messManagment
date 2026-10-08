import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  FEEDBACK_LIMITS,
  FeedbackType,
  MEAL_KEYS,
  RATING_MAX,
  RATING_MIN,
  type FeedbackListQuery,
  type GeneralFeedbackRequest,
  type MealFeedbackRequest,
  type MealType,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

const RATING_MESSAGE = `Choose a rating from ${RATING_MIN} to ${RATING_MAX}`;
const Rating = () => (target: object, key: string) => {
  IsInt({ message: RATING_MESSAGE })(target, key);
  Min(RATING_MIN, { message: RATING_MESSAGE })(target, key);
  Max(RATING_MAX, { message: RATING_MESSAGE })(target, key);
};

export class MealFeedbackDto implements MealFeedbackRequest {
  @IsUUID('4', { message: 'Choose a meal to rate' })
  attendanceId: string;

  @Rating()
  overallRating: number;

  @IsOptional() @Rating() tasteRating?: number;
  @IsOptional() @Rating() qualityRating?: number;
  @IsOptional() @Rating() quantityRating?: number;
  @IsOptional() @Rating() cleanlinessRating?: number;

  @OptionalText(FEEDBACK_LIMITS.commentMax)
  comment?: string;
}

export class GeneralFeedbackDto implements GeneralFeedbackRequest {
  @IsOptional() @Rating() overallRating?: number;

  @OptionalText(FEEDBACK_LIMITS.commentMax)
  comment?: string;
}

export class ListFeedbackQueryDto extends PaginationQueryDto implements FeedbackListQuery {
  @IsOptional() @IsIn(Object.values(FeedbackType)) type?: FeedbackType;
  @IsOptional() @IsDateOnly() from?: string;
  @IsOptional() @IsDateOnly() to?: string;
  @IsOptional() @IsIn(MEAL_KEYS) mealType?: MealType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(RATING_MIN) @Max(RATING_MAX) rating?: number;
  @IsOptional() @Trim() @MaxLength(100) search?: string;
}

export class SummaryQueryDto {
  @IsDateOnly() from: string;
  @IsDateOnly() to: string;
}
