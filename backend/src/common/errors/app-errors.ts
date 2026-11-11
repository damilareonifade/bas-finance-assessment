export interface FieldError {
  readonly field: string;
  readonly message: string;
}

/** Base class for every error we raise on purpose. The filter turns it into the uniform API envelope. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: readonly FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationFailedError extends AppError {
  constructor(fieldErrors: readonly FieldError[], message = 'Validation failed') {
    super(422, 'VALIDATION_FAILED', message, fieldErrors);
  }
}

/** Shorthand for a single-field domain validation failure (e.g. payment date before disbursement). */
export function fieldError(field: string, message: string): ValidationFailedError {
  return new ValidationFailedError([{ field, message }]);
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do this', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

/** A broken internal invariant (e.g. an unbalanced journal). Never caused by client input. */
export class InvariantViolationError extends AppError {
  constructor(message: string) {
    super(500, 'INVARIANT_VIOLATION', message);
  }
}
