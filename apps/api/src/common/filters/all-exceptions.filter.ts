import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ApiErrorBody, ErrorCode } from '@mess/shared';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.FILE_INVALID,
  429: ErrorCode.RATE_LIMITED,
};

/** Converts every error into the `{ error: { code, message, fields? } }` shape. Never leaks internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ThrottlerException) {
      return this.body(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'Too many attempts. Please wait a minute and try again.');
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response && 'code' in response) {
        const { code, message, fields } = response as { code: string; message: string; fields?: Record<string, string[]> };
        return { status, body: { error: { code, message, ...(fields ? { fields } : {}) } } };
      }
      const message = typeof response === 'string' ? response : exception.message;
      return this.body(status, STATUS_CODES[status] ?? ErrorCode.INTERNAL_ERROR, message);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return this.body(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'This record already exists');
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    return this.body(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, 'Something went wrong. Please try again.');
  }

  private body(status: number, code: ErrorCode, message: string) {
    return { status, body: { error: { code, message } } };
  }
}
