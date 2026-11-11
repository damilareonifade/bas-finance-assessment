import { z } from 'zod';
import { applicationStatusSchema } from '@/features/applications/schemas/application';
import { documentStatusSchema, documentTypeSchema } from '@/features/customer-documents/schemas/document';
import { personRefSchema, termLoanQuoteSchema } from '@/features/term-loans';
import { formatKobo, koboSchema, parseNairaInputToKobo, type Kobo } from '@/lib/money';

export const portalCustomerSchema = z.object({ accountId: z.string(), customerId: z.string(), fullName: z.string(), email: z.string() });
export type PortalCustomer = z.infer<typeof portalCustomerSchema>;
export const portalSessionResponseSchema = z.object({ customer: portalCustomerSchema });
export const portalInvitationPreviewSchema = z.object({ email: z.string(), fullName: z.string() });

export const instalmentStatusSchema = z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']);

export const portalLoanSummarySchema = z.object({
  loanId: z.string(),
  productName: z.string().nullable(),
  principalKobo: koboSchema,
  annualRatePercent: z.number(),
  termMonths: z.number().int(),
  instalmentKobo: koboSchema,
  disbursedOn: z.string(),
  outstandingPrincipalKobo: koboSchema,
  overdueKobo: koboSchema,
  nextPayment: z.object({ instalmentNumber: z.number().int(), dueDate: z.string(), amountDueKobo: koboSchema }).nullable(),
  status: z.enum(['ACTIVE', 'PAID_OFF']),
});
export type PortalLoanSummary = z.infer<typeof portalLoanSummarySchema>;

export const portalStatementRowSchema = z.object({
  entryId: z.string(),
  postedOn: z.string(),
  kind: z.enum(['DISBURSEMENT', 'PAYMENT', 'OTHER']),
  description: z.string(),
  amountKobo: koboSchema,
  principalKobo: koboSchema,
  interestKobo: koboSchema,
  creditKobo: koboSchema,
  balanceAfterKobo: koboSchema,
});
export type PortalStatementRow = z.infer<typeof portalStatementRowSchema>;

/** The customer's loan officer, with an email so they know how to reach them. */
export const portalOfficerSchema = personRefSchema.extend({ email: z.string() });
export type PortalOfficer = z.infer<typeof portalOfficerSchema>;

export const portalLoanDetailSchema = portalLoanSummarySchema.extend({
  schedule: z.array(
    z.object({
      instalmentNumber: z.number().int(),
      dueDate: z.string(),
      paymentKobo: koboSchema,
      interestKobo: koboSchema,
      principalKobo: koboSchema,
      closingBalanceKobo: koboSchema,
      principalPaidKobo: koboSchema,
      status: instalmentStatusSchema,
    }),
  ),
  unappliedCreditKobo: koboSchema,
  officer: portalOfficerSchema.nullable(),
  statement: z.array(portalStatementRowSchema),
});
export type PortalLoanDetail = z.infer<typeof portalLoanDetailSchema>;

export const portalApplicationSchema = z.object({
  applicationId: z.string(),
  status: applicationStatusSchema,
  product: z.object({ productId: z.string(), name: z.string() }).nullable(),
  principalKobo: koboSchema,
  annualRatePercent: z.number(),
  termMonths: z.number().int(),
  purpose: z.string().nullable(),
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  loanId: z.string().nullable(),
});
export type PortalApplication = z.infer<typeof portalApplicationSchema>;

export const portalDocumentSchema = z.object({
  documentId: z.string(),
  type: documentTypeSchema,
  typeLabel: z.string(),
  status: documentStatusSchema,
  identifierMasked: z.string().nullable(),
  hasFile: z.boolean(),
  fileName: z.string().nullable(),
  requestNote: z.string().nullable(),
  requestedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
});
export type PortalDocument = z.infer<typeof portalDocumentSchema>;

export const portalProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  annualRatePercent: z.number(),
  minPrincipalKobo: koboSchema,
  maxPrincipalKobo: koboSchema,
  minTermMonths: z.number().int(),
  maxTermMonths: z.number().int(),
});
export type PortalProduct = z.infer<typeof portalProductSchema>;

export const portalQuoteSchema = termLoanQuoteSchema.extend({ annualRatePercent: z.number() });
export type PortalQuote = z.infer<typeof portalQuoteSchema>;

/** An invoice the customer financed with us: what we paid them, what we hold back, what it costs (server-computed). */
export const portalInvoiceSchema = z.object({
  invoiceId: z.string(),
  productName: z.string().nullable(),
  status: z.enum(['OPEN', 'OVERDUE', 'SETTLED']),
  faceValueKobo: koboSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  tenorDays: z.number().int(),
  advanceKobo: koboSchema,
  reserveKobo: koboSchema,
  discountFeeKobo: koboSchema,
  latePenaltyPerDayKobo: koboSchema,
  daysOverdue: z.number().int(),
  latePenaltyKobo: koboSchema,
  reserveReleasedKobo: koboSchema,
  totalPaidToYouKobo: koboSchema,
  youOweKobo: koboSchema,
  settledOn: z.string().nullable(),
  ifSettledToday: z.object({ reserveReleasedKobo: koboSchema, youOweKobo: koboSchema }).nullable(),
});
export type PortalInvoice = z.infer<typeof portalInvoiceSchema>;

export const portalOverviewSchema = z.object({
  customer: z.object({ customerId: z.string(), fullName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
  officer: portalOfficerSchema.nullable(),
  loans: z.array(portalLoanSummarySchema),
  invoices: z.array(portalInvoiceSchema),
  applications: z.array(portalApplicationSchema),
  documents: z.object({ toProvide: z.number().int(), awaitingReview: z.number().int(), needsAttention: z.number().int(), verified: z.number().int() }),
});
export type PortalOverview = z.infer<typeof portalOverviewSchema>;

export const portalNotificationSchema = z.object({
  notificationId: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export const portalInboxSchema = z.object({ unreadCount: z.number().int(), items: z.array(portalNotificationSchema) });
export type PortalInbox = z.infer<typeof portalInboxSchema>;

/* ---------- Forms ---------- */

export const portalLoginFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});
export type PortalLoginFormInput = z.input<typeof portalLoginFormSchema>;
export type PortalLoginRequest = z.output<typeof portalLoginFormSchema>;

export const portalSetPasswordFormSchema = z
  .object({ password: z.string().min(8, 'Use at least 8 characters'), confirmPassword: z.string().min(1, 'Repeat your password') })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type PortalSetPasswordFormInput = z.input<typeof portalSetPasswordFormSchema>;
export type PortalSetPasswordValues = z.output<typeof portalSetPasswordFormSchema>;

/** Validates the apply form against the chosen product's limits, so mistakes show before the server is asked. */
export function checkApplication(
  product: PortalProduct | undefined,
  amountInput: string,
  termInput: string,
): { errors: Partial<Record<'loanProductId' | 'amount' | 'termMonths', string>>; principalKobo?: Kobo; termMonths?: number } {
  if (!product) return { errors: { loanProductId: 'Choose a loan' } };
  const errors: Partial<Record<'amount' | 'termMonths', string>> = {};
  const principalKobo = parseNairaInputToKobo(amountInput.trim());
  if (principalKobo === null) errors.amount = 'Enter an amount in naira, e.g. 250000';
  else if (principalKobo < product.minPrincipalKobo || principalKobo > product.maxPrincipalKobo) {
    errors.amount = `Choose between ${formatKobo(product.minPrincipalKobo)} and ${formatKobo(product.maxPrincipalKobo)}`;
  }
  const termMonths = /^\d+$/.test(termInput.trim()) ? Number(termInput.trim()) : Number.NaN;
  if (Number.isNaN(termMonths) || termMonths < product.minTermMonths || termMonths > product.maxTermMonths) {
    errors.termMonths = `Choose ${product.minTermMonths} to ${product.maxTermMonths} months`;
  }
  return Object.keys(errors).length > 0 || principalKobo === null ? { errors } : { errors, principalKobo, termMonths };
}
