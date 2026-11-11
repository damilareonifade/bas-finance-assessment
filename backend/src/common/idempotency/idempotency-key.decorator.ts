import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { BadRequestError } from '../errors/app-errors';
import type { IdempotencyContext } from './idempotency.service';

const MAX_KEY_LENGTH = 255;

/** Extracts the required Idempotency-Key header (400 when missing). */
export const Idempotency = createParamDecorator((_data: unknown, executionContext: ExecutionContext): IdempotencyContext => {
  const request = executionContext.switchToHttp().getRequest<Request>();
  const header = request.headers['idempotency-key'];
  const key = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!key) throw new BadRequestError('IDEMPOTENCY_KEY_REQUIRED', 'The Idempotency-Key header is required for this request');
  if (key.length > MAX_KEY_LENGTH) throw new BadRequestError('IDEMPOTENCY_KEY_INVALID', 'The Idempotency-Key header is too long');
  return { key, scope: `${request.method} ${request.path}` };
});
