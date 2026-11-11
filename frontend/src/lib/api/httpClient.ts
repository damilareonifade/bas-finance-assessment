import { z } from 'zod';
import { env } from '@/config/env';
import { ApiError, ApiValidationError } from './apiError';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequest<TSchema extends z.ZodType> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly responseSchema: TSchema;
  readonly body?: unknown;
  /** Required for every request that posts to the ledger. */
  readonly idempotencyKey?: string;
}

const errorEnvelopeSchema = z.object({
  statusCode: z.number().optional(),
  code: z.string().default('UNKNOWN_ERROR'),
  message: z.string().default('Something went wrong'),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The only function in the app that calls fetch. Every response is parsed through its zod schema. */
export async function apiRequest<TSchema extends z.ZodType>(request: ApiRequest<TSchema>): Promise<z.output<TSchema>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // FormData (file uploads) sets its own multipart boundary — never override it.
  const isMultipart = request.body instanceof FormData;
  if (request.body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';
  if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}${request.path}`, {
      method: request.method,
      credentials: 'include',
      headers,
      body: request.body === undefined ? undefined : isMultipart ? (request.body as FormData) : JSON.stringify(request.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  const payload = await readJsonSafely(response);

  if (!response.ok) {
    const envelope = errorEnvelopeSchema.safeParse(payload);
    const { code, message, errors } = envelope.success
      ? envelope.data
      : { code: 'UNKNOWN_ERROR', message: `Request failed (${response.status})`, errors: undefined };
    if (errors && errors.length > 0) throw new ApiValidationError(response.status, code, message, errors);
    throw new ApiError(response.status, code, message);
  }

  return request.responseSchema.parse(payload);
}
