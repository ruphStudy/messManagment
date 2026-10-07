import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  EMAIL_REGEX,
  FoodType,
  INDIAN_STATES,
  LIMITS,
  MessInput,
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
}

export class UpdateMessDto extends PartialType(CreateMessDto) {}
