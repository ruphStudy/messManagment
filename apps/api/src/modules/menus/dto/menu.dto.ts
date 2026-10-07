import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import {
  MENU_LIMITS,
  normalizeMenuItems,
  type CopyMenuRequest,
  type CopyWeekRequest,
  type DailyMenuInput,
  type MenuMeal,
} from '@mess/shared';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

export class MenuMealDto implements MenuMeal {
  @IsBoolean()
  available: boolean;

  /** Trimmed; blanks and duplicates removed before validation. */
  @Transform(({ value }) => (Array.isArray(value) && value.every((v) => typeof v === 'string') ? normalizeMenuItems(value) : value))
  @IsArray()
  @ArrayMaxSize(MENU_LIMITS.itemsPerMeal, { message: `Add at most ${MENU_LIMITS.itemsPerMeal} items per meal` })
  @IsString({ each: true })
  @MaxLength(MENU_LIMITS.itemLength, { each: true, message: `Keep each item under ${MENU_LIMITS.itemLength} characters` })
  items: string[];

  @OptionalText(MENU_LIMITS.mealNoteLength)
  note: string | null;
}

export class DailyMenuDto implements DailyMenuInput {
  @IsDefined()
  @ValidateNested()
  @Type(() => MenuMealDto)
  breakfast: MenuMealDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => MenuMealDto)
  lunch: MenuMealDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => MenuMealDto)
  dinner: MenuMealDto;

  @OptionalText(MENU_LIMITS.generalNoteLength)
  generalNote: string | null;
}

export class MenuRangeQueryDto {
  @IsDateOnly()
  from: string;

  @IsDateOnly()
  to: string;
}

export class CopyMenuDto implements CopyMenuRequest {
  @IsDateOnly()
  sourceDate: string;

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

export class CopyWeekDto implements CopyWeekRequest {
  @IsDateOnly()
  weekStart: string;

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
