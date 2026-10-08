import { PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  EMAIL_REGEX,
  FoodType,
  INDIAN_STATES,
  LIMITS,
  MessInput,
  MESS_SETTINGS_FIELDS,
  MESSAGES,
  MessType,
  MOBILE_REGEX,
  PINCODE_REGEX,
  TIME_REGEX,
} from '@mess/shared';
import { EmptyToNull, NormalizeMobile, Trim, TrimLower } from '../../../common/http/transforms';

export class CreateMessDto implements MessInput {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Mess name is required' })
  @MaxLength(LIMITS.messNameMax)
  name: string;

  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;

  @IsOptional()
  @TrimLower()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(LIMITS.emailMax)
  @Matches(EMAIL_REGEX, { message: MESSAGES.email })
  email: string | null;

  @IsEnum(MessType)
  messType: MessType;

  @IsEnum(FoodType)
  foodType: FoodType;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  @MaxLength(LIMITS.addressMax)
  address: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MaxLength(LIMITS.cityMax)
  city: string;

  @IsIn(INDIAN_STATES, { message: 'Select a state' })
  state: string;

  @Trim()
  @Matches(PINCODE_REGEX, { message: MESSAGES.pincode })
  pincode: string;

  @IsBoolean()
  breakfastAvailable: boolean;

  @IsBoolean()
  lunchAvailable: boolean;

  @IsBoolean()
  dinnerAvailable: boolean;

  @IsOptional()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(TIME_REGEX, { message: MESSAGES.time })
  openingTime: string | null;

  @IsOptional()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(TIME_REGEX, { message: MESSAGES.time })
  closingTime: string | null;

  /** HH:mm — same-day pause cut-offs (defaults 06:00 / 09:00 / 16:00). */
  @IsOptional()
  @Matches(TIME_REGEX, { message: MESSAGES.time })
  breakfastPauseCutoff?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: MESSAGES.time })
  lunchPauseCutoff?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: MESSAGES.time })
  dinnerPauseCutoff?: string;

  /** HH:mm serving windows (defaults 07:30–09:30 / 12:00–14:30 / 19:30–21:30). */
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) breakfastStart?: string;
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) breakfastEnd?: string;
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) lunchStart?: string;
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) lunchEnd?: string;
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) dinnerStart?: string;
  @IsOptional() @Matches(TIME_REGEX, { message: MESSAGES.time }) dinnerEnd?: string;
}

/** Owner: everything. */
export class UpdateMessDto extends PartialType(CreateMessDto) {}

/** Owner or manager: operational settings only (profile/contact fields are rejected as unknown). */
export class UpdateMessSettingsDto extends PickType(UpdateMessDto, MESS_SETTINGS_FIELDS) {}
