import { applyDecorators } from '@nestjs/common';
import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_REGEX, MESSAGES } from '@mess/shared';
import { EmptyToNull, Trim } from './transforms';

/** Optional free text: blank becomes null so fields can be cleared. */
export const OptionalText = (max: number) => applyDecorators(IsOptional(), EmptyToNull(), IsString(), MaxLength(max));

/** A real calendar date in YYYY-MM-DD form. */
export const IsDateOnly = () =>
  applyDecorators(Trim(), Matches(DATE_REGEX, { message: MESSAGES.date }), IsISO8601({ strict: true }, { message: MESSAGES.date }));
