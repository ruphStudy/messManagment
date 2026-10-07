import { Injectable, Param, PipeTransform } from '@nestjs/common';
import { isValidDateString, MESSAGES } from '@mess/shared';
import { AppException } from './app.exception';

/** Validates a YYYY-MM-DD calendar date route param. */
@Injectable()
export class DateParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidDateString(value)) throw AppException.validation({ date: [MESSAGES.date] });
    return value;
  }
}

export const DateParam = (name = 'date') => Param(name, DateParamPipe);
