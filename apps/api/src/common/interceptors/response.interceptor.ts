import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { ApiSuccess } from '@mess/shared';
import { Paginated } from '../http/pagination';

/** Wraps every successful response as `{ data }` (or `{ data, meta }` for paginated results). */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((value): ApiSuccess<unknown> => {
        if (value instanceof Paginated) return { data: value.items, meta: value.meta };
        return { data: value ?? null };
      }),
    );
  }
}
