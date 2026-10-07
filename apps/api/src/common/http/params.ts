import { Param, ParseUUIDPipe } from '@nestjs/common';
import { AppException } from './app.exception';

/** UUID route param; malformed ids are reported as "not found", same as ids from another mess. */
export const UuidParam = (name: string, label: string) =>
  Param(name, new ParseUUIDPipe({ exceptionFactory: () => AppException.notFound(`${label} not found`) }));
