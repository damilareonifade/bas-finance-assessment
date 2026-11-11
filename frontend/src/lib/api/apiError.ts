export interface ApiFieldError {
  readonly field: string;
  readonly message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** A 400/422 carrying per-field errors the UI can show against the right input. */
export class ApiValidationError extends ApiError {
  readonly fieldErrors: readonly ApiFieldError[];

  constructor(statusCode: number, code: string, message: string, fieldErrors: readonly ApiFieldError[]) {
    super(statusCode, code, message);
    this.name = 'ApiValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * What to tell a person about a failed request: one line per problem, with server field names (`principalKobo`)
 * replaced by the label they see on screen (`Principal`). A validation error lists its field messages instead of
 * the generic "Validation failed"; anything else is its own message.
 */
export function describeApiError(error: unknown, fieldLabels: Readonly<Record<string, string>> = {}): readonly string[] {
  if (error instanceof ApiValidationError && error.fieldErrors.length > 0) {
    return error.fieldErrors.map(({ field, message }) => {
      const label = fieldLabels[field];
      if (!label) return message;
      // class-validator messages start with the property name ("termMonths must not be greater than 60").
      return message.startsWith(`${field} `) ? `${label} ${message.slice(field.length + 1)}` : message;
    });
  }
  if (error instanceof Error && error.message) return [error.message];
  return ['Something went wrong. Please try again.'];
}

/**
 * Maps server field names (`principalKobo`) to form field names (`principalInput`).
 * Errors for unmapped fields are returned under `unmapped` so the form can show them in a summary.
 */
export function mapServerFieldErrors<TFormField extends string>(
  error: unknown,
  serverToFormField: Readonly<Record<string, TFormField>>,
): { readonly mapped: ReadonlyArray<{ field: TFormField; message: string }>; readonly unmapped: readonly string[] } {
  if (!(error instanceof ApiValidationError)) return { mapped: [], unmapped: [] };

  const mapped: Array<{ field: TFormField; message: string }> = [];
  const unmapped: string[] = [];
  for (const { field, message } of error.fieldErrors) {
    const formField = serverToFormField[field];
    if (formField) mapped.push({ field: formField, message });
    else unmapped.push(`${field}: ${message}`);
  }
  return { mapped, unmapped };
}
