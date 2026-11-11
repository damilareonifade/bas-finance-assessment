import { z } from 'zod';
import { koboSchema } from '@/lib/money';

export const officerRefSchema = z.object({ userId: z.string(), fullName: z.string() });
export type OfficerRef = z.infer<typeof officerRefSchema>;

export const customerSummarySchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  assignedOfficer: officerRefSchema.nullable(),
  createdAt: z.string(),
  loanCount: z.number().int(),
  invoiceCount: z.number().int(),
  outstandingPrincipalKobo: koboSchema,
  overdueKobo: koboSchema,
  overdueInvoiceCount: z.number().int(),
});
export type CustomerSummary = z.infer<typeof customerSummarySchema>;

export const customerLoanLineSchema = z.object({
  loanId: z.string(),
  productName: z.string().nullable(),
  principalKobo: koboSchema,
  outstandingPrincipalKobo: koboSchema,
  overdueKobo: koboSchema,
  disbursedOn: z.string(),
});
export type CustomerLoanLine = z.infer<typeof customerLoanLineSchema>;

export const customerInvoiceLineSchema = z.object({
  invoiceId: z.string(),
  productName: z.string().nullable(),
  faceValueKobo: koboSchema,
  advanceKobo: koboSchema,
  dueDate: z.string(),
  status: z.enum(['ADVANCED', 'SETTLED']),
  isOverdue: z.boolean(),
});
export type CustomerInvoiceLine = z.infer<typeof customerInvoiceLineSchema>;

export const customerDetailSchema = z.object({
  customer: customerSummarySchema,
  loans: z.array(customerLoanLineSchema),
  invoices: z.array(customerInvoiceLineSchema),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

/* ---------- Forms ---------- */

const optionalText = z.string().trim().transform((value) => (value === '' ? undefined : value));

export const customerFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the customer’s full name'),
  email: optionalText.pipe(z.string().email('Enter a valid email address').optional()),
  phone: optionalText.pipe(z.string().regex(/^[+0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number').optional()),
  assignedOfficerId: optionalText,
});
export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerRequest = z.output<typeof customerFormSchema>;

export const CUSTOMER_SERVER_FIELD_MAP = {
  fullName: 'fullName',
  email: 'email',
  phone: 'phone',
  assignedOfficerId: 'assignedOfficerId',
} as const satisfies Record<string, keyof CustomerFormInput>;
