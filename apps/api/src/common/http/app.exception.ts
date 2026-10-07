import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@mess/shared';

export interface AppErrorPayload {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string[]>;
}

/** HttpException carrying a stable machine-readable error code for clients. */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, fields?: Record<string, string[]>) {
    super({ code, message, fields } satisfies AppErrorPayload, status);
  }

  static validation(fields: Record<string, string[]>, message = 'Please correct the highlighted fields') {
    return new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message, fields);
  }

  static unauthorized(message = 'Please sign in to continue', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(message = 'You do not have access to this', code: ErrorCode = ErrorCode.FORBIDDEN) {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(message = 'Not found') {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string, fields?: Record<string, string[]>, code: ErrorCode = ErrorCode.CONFLICT) {
    return new AppException(HttpStatus.CONFLICT, code, message, fields);
  }
}
