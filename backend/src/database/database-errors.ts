import { AppError, ConflictError } from '../common/errors/app-errors';
import { Prisma } from '../generated/prisma/client';

/**
 * Database guards (triggers in the migration SQL) that a request can legitimately trip when it races another request.
 * Services check these rules first and answer with a friendly 409; the trigger is the backstop, so the answer is the same.
 */
const GUARD_CONFLICTS: Readonly<Record<string, string>> = {
  APPLICATION_ALREADY_DECIDED: 'This application was already decided',
  INVOICE_ALREADY_SETTLED: 'This invoice is already settled',
  DOCUMENT_ALREADY_REVIEWED: 'This document was already reviewed',
  DOCUMENT_ALREADY_OPEN: 'A document of this type is already requested or waiting for review',
  PRODUCT_NAME_TAKEN: 'A loan product with this name already exists',
};

function messageChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) parts.push(current.message);
    if (typeof current === 'object' && current !== null && 'meta' in current) parts.push(JSON.stringify((current as { meta?: unknown }).meta ?? ''));
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(' | ');
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Turns known constraint failures into domain errors. Anything else is returned unchanged (and becomes a 500). */
export function translateDatabaseError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  const text = messageChain(error);
  for (const [code, message] of Object.entries(GUARD_CONFLICTS)) {
    if (text.includes(code)) return new ConflictError(code, message);
  }
  if (isUniqueConstraintViolation(error)) return new ConflictError('ALREADY_EXISTS', 'This record already exists — it may have just been created by another request');
  return error;
}
