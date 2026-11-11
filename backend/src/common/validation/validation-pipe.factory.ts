import { ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldError, ValidationFailedError } from '../errors/app-errors';

function flattenValidationErrors(errors: readonly ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map((message) => ({ field: path, message }));
    return [...ownMessages, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

/** Global pipe: strips unknown properties, never coerces types (so "100" is not a kobo integer), emits the field-error envelope. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => new ValidationFailedError(flattenValidationErrors(errors)),
  });
}
