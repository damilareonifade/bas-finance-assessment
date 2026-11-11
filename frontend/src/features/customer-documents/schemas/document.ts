import { z } from 'zod';
import { personRefSchema } from '@/features/term-loans';

export const DOCUMENT_TYPES = ['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENCE', 'BANK_STATEMENT', 'UTILITY_BILL', 'OTHER'] as const;
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  BVN: 'BVN',
  NIN: 'NIN',
  PASSPORT: 'International passport',
  DRIVERS_LICENCE: "Driver's licence",
  BANK_STATEMENT: 'Bank statement',
  UTILITY_BILL: 'Utility bill',
  OTHER: 'Other document',
};

export const documentStatusSchema = z.enum(['REQUESTED', 'SUBMITTED', 'VERIFIED', 'REJECTED']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const customerDocumentSchema = z.object({
  documentId: z.string(),
  customerId: z.string(),
  type: documentTypeSchema,
  typeLabel: z.string(),
  status: documentStatusSchema,
  identifierMasked: z.string().nullable(),
  hasFile: z.boolean(),
  fileName: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  requestNote: z.string().nullable(),
  requestedBy: personRefSchema.nullable(),
  requestedAt: z.string().nullable(),
  submittedBy: personRefSchema.nullable(),
  submittedByCustomer: z.boolean(),
  submittedAt: z.string().nullable(),
  reviewedBy: personRefSchema.nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
});
export type CustomerDocument = z.infer<typeof customerDocumentSchema>;

export const revealedDocumentSchema = customerDocumentSchema.extend({ identifier: z.string().nullable() });

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;

/** Mirrors the server's rules so mistakes show before upload. Returns field → message. */
export function checkSubmission(type: DocumentType, identifier: string, file: File | null): Partial<Record<'identifier' | 'file', string>> {
  const digits = identifier.replace(/\s+/g, '');
  if (file && !(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) return { file: 'Upload a PDF, PNG or JPEG file' };
  if (file && file.size > MAX_DOCUMENT_BYTES) return { file: 'Files must be 5 MB or smaller' };
  if (type === 'BVN' || type === 'NIN') {
    if (!digits) return { identifier: `Enter the ${type}` };
    if (!/^\d{11}$/.test(digits)) return { identifier: `${type} must be exactly 11 digits` };
    return {};
  }
  if ((type === 'BANK_STATEMENT' || type === 'UTILITY_BILL') && !file) return { file: `Attach the ${DOCUMENT_TYPE_LABELS[type].toLowerCase()}` };
  if (!digits && !file) return { identifier: 'Enter the document number or attach a file' };
  return {};
}
