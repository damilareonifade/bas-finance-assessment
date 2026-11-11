import { fieldError } from '../common/errors/app-errors';

export const DOCUMENT_TYPES = ['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENCE', 'BANK_STATEMENT', 'UTILITY_BILL', 'OTHER'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = 'REQUESTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export const DOCUMENT_LABELS: Readonly<Record<DocumentType, string>> = {
  BVN: 'BVN',
  NIN: 'NIN',
  PASSPORT: 'International passport',
  DRIVERS_LICENCE: "Driver's licence",
  BANK_STATEMENT: 'Bank statement',
  UTILITY_BILL: 'Utility bill',
  OTHER: 'Other document',
};

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

const ELEVEN_DIGITS = /^\d{11}$/;

/**
 * What each type needs:
 *  - BVN / NIN: the 11-digit number (a file is optional)
 *  - passport / driver's licence / other: a number or a file
 *  - bank statement / utility bill: a file
 */
export function assertSubmissionComplete(type: DocumentType, identifier: string | undefined, hasFile: boolean): void {
  if (type === 'BVN' || type === 'NIN') {
    if (!identifier) throw fieldError('identifier', `Enter the ${type}`);
    if (!ELEVEN_DIGITS.test(identifier)) throw fieldError('identifier', `${type} must be exactly 11 digits`);
    return;
  }
  if ((type === 'BANK_STATEMENT' || type === 'UTILITY_BILL') && !hasFile) throw fieldError('file', `Attach the ${DOCUMENT_LABELS[type].toLowerCase()}`);
  if (!identifier && !hasFile) throw fieldError('identifier', 'Enter the document number or attach a file');
}

/** "22212345678" → "222••••••78". Lists never carry the full number. */
export function maskIdentifier(identifier: string | null): string | null {
  if (!identifier) return null;
  if (identifier.length < 6) return '•'.repeat(identifier.length);
  return `${identifier.slice(0, 3)}${'•'.repeat(identifier.length - 5)}${identifier.slice(-2)}`;
}
