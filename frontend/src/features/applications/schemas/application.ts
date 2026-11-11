import { z } from 'zod';
import { journalEntrySchema } from '@/features/ledger';
import { personRefSchema, termLoanQuoteSchema, termLoanSchema } from '@/features/term-loans';
import {
  formatKobo,
  koboSchema,
  MAX_ANNUAL_RATE_PERCENT,
  MAX_PRINCIPAL_KOBO,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL_KOBO,
  MIN_TERM_MONTHS,
  parseNairaInputToKobo,
} from '@/lib/money';

export const applicationStatusSchema = z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const APPLICATION_STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const verificationSummarySchema = z.object({
  requested: z.number().int(),
  awaitingReview: z.number().int(),
  verified: z.number().int(),
  rejected: z.number().int(),
});
export type VerificationSummary = z.infer<typeof verificationSummarySchema>;

export const applicationSchema = z.object({
  applicationId: z.string(),
  status: applicationStatusSchema,
  customer: z.object({ customerId: z.string(), fullName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
  product: z.object({ productId: z.string(), name: z.string() }).nullable(),
  principalKobo: koboSchema,
  annualRatePercent: z.number(),
  termMonths: z.number().int(),
  purpose: z.string().nullable(),
  assignedOfficer: personRefSchema.nullable(),
  /** STAFF: entered by a team member. PORTAL: the applicant applied online themselves. */
  channel: z.enum(['STAFF', 'PORTAL']),
  submittedBy: personRefSchema.nullable(),
  submittedAt: z.string(),
  reviewedBy: personRefSchema.nullable(),
  reviewStartedAt: z.string().nullable(),
  decidedBy: personRefSchema.nullable(),
  decidedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  loanId: z.string().nullable(),
});
export type LoanApplication = z.infer<typeof applicationSchema>;

export const applicationDetailSchema = applicationSchema.extend({
  verification: verificationSummarySchema,
  customerOfficer: personRefSchema.nullable(),
  quote: termLoanQuoteSchema,
});
export type LoanApplicationDetail = z.infer<typeof applicationDetailSchema>;

export const approvedApplicationSchema = z.object({ application: applicationDetailSchema, loan: termLoanSchema, journalEntry: journalEntrySchema });

export function isOpen(status: ApplicationStatus): boolean {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}

/* ---------- Create form ---------- */

const DECIMAL = /^\d+(\.\d+)?$/;
const WHOLE = /^\d+$/;

export const applicationFormSchema = z
  .object({
    customerIdInput: z.string().min(1, 'Choose the applicant'),
    loanProductIdInput: z.string(),
    principalInput: z.string().trim().min(1, 'Enter the amount requested'),
    annualRatePercentInput: z.string().trim().min(1, 'Enter the annual interest rate'),
    termMonthsInput: z.string().trim().min(1, 'Enter the term in months'),
    purposeInput: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .transform((values, context) => {
    const principalKobo = parseNairaInputToKobo(values.principalInput);
    if (principalKobo === null) context.addIssue({ code: 'custom', path: ['principalInput'], message: 'Enter a valid naira amount (max 2 decimals)' });
    else if (principalKobo < MIN_PRINCIPAL_KOBO || principalKobo > MAX_PRINCIPAL_KOBO) {
      context.addIssue({ code: 'custom', path: ['principalInput'], message: `Amount must be between ${formatKobo(MIN_PRINCIPAL_KOBO)} and ${formatKobo(MAX_PRINCIPAL_KOBO)}` });
    }
    const annualRatePercent = DECIMAL.test(values.annualRatePercentInput) ? Number(values.annualRatePercentInput) : Number.NaN;
    if (Number.isNaN(annualRatePercent) || annualRatePercent < MIN_ANNUAL_RATE_PERCENT || annualRatePercent > MAX_ANNUAL_RATE_PERCENT) {
      context.addIssue({ code: 'custom', path: ['annualRatePercentInput'], message: `Rate must be between ${MIN_ANNUAL_RATE_PERCENT}% and ${MAX_ANNUAL_RATE_PERCENT}%` });
    }
    const termMonths = WHOLE.test(values.termMonthsInput) ? Number(values.termMonthsInput) : Number.NaN;
    if (Number.isNaN(termMonths) || termMonths < MIN_TERM_MONTHS || termMonths > MAX_TERM_MONTHS) {
      context.addIssue({ code: 'custom', path: ['termMonthsInput'], message: `Term must be a whole number of months from ${MIN_TERM_MONTHS} to ${MAX_TERM_MONTHS}` });
    }
    if (principalKobo === null || context.issues.length > 0) return z.NEVER;
    return {
      customerId: values.customerIdInput,
      loanProductId: values.loanProductIdInput || undefined,
      principalKobo,
      annualRatePercent,
      termMonths,
      purpose: values.purposeInput || undefined,
    };
  });
export type ApplicationFormInput = z.input<typeof applicationFormSchema>;
export type ApplicationRequest = z.output<typeof applicationFormSchema>;

export const APPLICATION_SERVER_FIELD_MAP = {
  customerId: 'customerIdInput',
  loanProductId: 'loanProductIdInput',
  principalKobo: 'principalInput',
  annualRatePercent: 'annualRatePercentInput',
  termMonths: 'termMonthsInput',
  purpose: 'purposeInput',
} as const satisfies Record<string, keyof ApplicationFormInput>;
