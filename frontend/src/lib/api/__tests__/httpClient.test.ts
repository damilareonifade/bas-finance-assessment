import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { jsonResponse } from '@/test/renderWithProviders';
import { ApiError, ApiValidationError, mapServerFieldErrors } from '../apiError';
import { apiRequest } from '../httpClient';
import { koboSchema } from '@/lib/money';

afterEach(() => vi.restoreAllMocks());

describe('apiRequest', () => {
  it('sends the Idempotency-Key header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));
    await apiRequest({ method: 'POST', path: '/x', body: {}, idempotencyKey: 'key-123', responseSchema: z.object({ ok: z.boolean() }) });
    const init = fetchSpy.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('key-123');
  });

  it('turns a field-error envelope into ApiValidationError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Validation failed', errors: [{ field: 'principalKobo', message: 'too small' }] }, 422),
    );
    const failure = await apiRequest({ method: 'POST', path: '/x', responseSchema: z.unknown() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiValidationError);
    expect(mapServerFieldErrors(failure, { principalKobo: 'principalInput' }).mapped).toEqual([{ field: 'principalInput', message: 'too small' }]);
  });

  it('turns other failures into ApiError and reports network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ code: 'LOAN_NOT_FOUND', message: 'No such loan' }, 404));
    await expect(apiRequest({ method: 'GET', path: '/x', responseSchema: z.unknown() })).rejects.toMatchObject({ statusCode: 404, code: 'LOAN_NOT_FOUND' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    await expect(apiRequest({ method: 'GET', path: '/x', responseSchema: z.unknown() })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a float money value from the server instead of silently accepting it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ amountKobo: 10.5 }));
    await expect(apiRequest({ method: 'GET', path: '/x', responseSchema: z.object({ amountKobo: koboSchema }) })).rejects.toThrow();
  });
});
