import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from './app.exception';

function collect(errors: ValidationError[], prefix = '', out: Record<string, string[]> = {}) {
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) out[field] = Object.values(error.constraints);
    if (error.children?.length) collect(error.children, field, out);
  }
  return out;
}

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => AppException.validation(collect(errors)),
  });
}
