import { describe, expect, it } from 'vitest';
import { ApiError, ApiValidationError, describeApiError } from '../apiError';

describe('describeApiError', () => {
  it('lists the field reasons instead of the generic "Validation failed"', () => {
    const error = new ApiValidationError(422, 'VALIDATION_FAILED', 'Validation failed', [
      { field: 'principalKobo', message: 'Abakyraye loan lends ₦10,000.00 to ₦200,000.00. ₦5,000,000.00 is above that.' },
      { field: 'termMonths', message: 'termMonths must not be greater than 60' },
    ]);
    expect(describeApiError(error, { principalKobo: 'Principal', termMonths: 'Term' })).toEqual([
      'Abakyraye loan lends ₦10,000.00 to ₦200,000.00. ₦5,000,000.00 is above that.',
      'Term must not be greater than 60',
    ]);
  });

  it('uses the message of any other API error, and has a fallback for the unknown', () => {
    expect(describeApiError(new ApiError(403, 'FORBIDDEN', 'You can only lend to customers assigned to you'))).toEqual(['You can only lend to customers assigned to you']);
    expect(describeApiError('boom')).toEqual(['Something went wrong. Please try again.']);
  });
});
