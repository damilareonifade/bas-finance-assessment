import { z } from 'zod';
import { journalEntrySchema } from '@/features/ledger';
import {
  koboSchema,
  MAX_ANNUAL_RATE_PERCENT,
  MAX_PRINCIPAL_KOBO,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL_KOBO,
  MIN_TERM_MONTHS,
  parseNairaInputToKobo,
  formatKobo,
} from '@/lib/money';

/* ---------- Form: inputs are strings (what the user typed); output is validated domain values ---------- */

const DECIMAL_NUMBER_PATTERN = /^\d+(\.\d+)?$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export const termLoanFormSchema = z
  .object({
    principalInput: z.string().trim().min(1, 'Enter the principal amount'),
    annualRatePercentInput: z.string().trim().min(1, 'Enter the annual interest rate'),
    termMonthsInput: z.string().trim().min(1, 'Enter the term in months'),
    customerIdInput: z.string(),
    loanProductIdInput: z.string(),
  })
  .transform((values, context) => {
    const principalKobo = parseNairaInputToKobo(values.principalInput);
    if (principalKobo === null) {
      context.addIssue({ code: 'custom', path: ['principalInput'], message: 'Enter a valid naira amount (max 2 decimals)' });
    } else if (principalKobo < MIN_PRINCIPAL_KOBO || principalKobo > MAX_PRINCIPAL_KOBO) {
      context.addIssue({
        code: 'custom',
        path: ['principalInput'],
        message: `Principal must be between ${formatKobo(MIN_PRINCIPAL_KOBO)} and ${formatKobo(MAX_PRINCIPAL_KOBO)}`,
      });
    }

    const annualRatePercent = DECIMAL_NUMBER_PATTERN.test(values.annualRatePercentInput) ? Number(values.annualRatePercentInput) : Number.NaN;
    if (Number.isNaN(annualRatePercent)) {
      context.addIssue({ code: 'custom', path: ['annualRatePercentInput'], message: 'Enter a valid percentage' });
    } else if (annualRatePercent < MIN_ANNUAL_RATE_PERCENT || annualRatePercent > MAX_ANNUAL_RATE_PERCENT) {
      context.addIssue({
        code: 'custom',
        path: ['annualRatePercentInput'],
        message: `Rate must be between ${MIN_ANNUAL_RATE_PERCENT}% and ${MAX_ANNUAL_RATE_PERCENT}%`,
      });
    }

    const termMonths = WHOLE_NUMBER_PATTERN.test(values.termMonthsInput) ? Number(values.termMonthsInput) : Number.NaN;
    if (Number.isNaN(termMonths) || termMonths < MIN_TERM_MONTHS || termMonths > MAX_TERM_MONTHS) {
      context.addIssue({
        code: 'custom',
        path: ['termMonthsInput'],
        message: `Term must be a whole number of months from ${MIN_TERM_MONTHS} to ${MAX_TERM_MONTHS}`,
      });
    }

    if (principalKobo === null || context.issues.length > 0) return z.NEVER;
    return {
      principalKobo,
      annualRatePercent,
      termMonths,
      customerId: values.customerIdInput === '' ? undefined : values.customerIdInput,
      loanProductId: values.loanProductIdInput === '' ? undefined : values.loanProductIdInput,
    };
  });

export type TermLoanFormInput = z.input<typeof termLoanFormSchema>;
export type TermLoanRequest = z.output<typeof termLoanFormSchema>;

/** Server field → the label on screen, for error messages. */
export const TERM_LOAN_FIELD_LABELS: Readonly<Record<string, string>> = {
  principalKobo: 'Principal',
  annualRatePercent: 'Annual interest rate',
  termMonths: 'Term',
  customerId: 'Customer',
  loanProductId: 'Loan product',
  disbursedOn: 'Disbursement date',
};

/** Server field name → form field name, so server validation errors land on the right input. */
export const TERM_LOAN_SERVER_FIELD_MAP = {
  principalKobo: 'principalInput',
  annualRatePercent: 'annualRatePercentInput',
  termMonths: 'termMonthsInput',
  customerId: 'customerIdInput',
  loanProductId: 'loanProductIdInput',
} as const satisfies Record<string, keyof TermLoanFormInput>;

/* ---------- Responses ---------- */

export const quoteInstalmentSchema = z.object({
  instalmentNumber: z.number().int().positive(),
  paymentKobo: koboSchema,
  interestKobo: koboSchema,
  principalKobo: koboSchema,
  closingBalanceKobo: koboSchema,
});

export const termLoanQuoteSchema = z.object({
  instalmentKobo: koboSchema,
  totalInterestKobo: koboSchema,
  schedule: z.array(quoteInstalmentSchema).min(1),
});
export type TermLoanQuote = z.infer<typeof termLoanQuoteSchema>;

export const instalmentStatusSchema = z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']);

export const loanInstalmentSchema = quoteInstalmentSchema.extend({
  dueDate: z.string(),
  status: instalmentStatusSchema,
  /** Principal already collected against this instalment. */
  principalPaidKobo: koboSchema,
});
export type LoanInstalment = z.infer<typeof loanInstalmentSchema>;

export const personRefSchema = z.object({ userId: z.string(), fullName: z.string() });
export type PersonRef = z.infer<typeof personRefSchema>;

export const termLoanSchema = z.object({
  loanId: z.string(),
  /** Who approved (and so disbursed) the loan. */
  approvedBy: personRefSchema.nullable(),
  approvedAt: z.string().nullable(),
  /** The loan officer following this loan up. */
  assignedOfficer: personRefSchema.nullable(),
  /** The application it came from, if any. */
  applicationId: z.string().nullable(),
  customerId: z.string().nullable(),
  loanProductId: z.string().nullable(),
  /** Principal still owed, according to the schedule. */
  outstandingPrincipalKobo: koboSchema,
  principalKobo: koboSchema,
  annualRatePercent: z.number(),
  termMonths: z.number().int(),
  disbursedOn: z.string(),
  unappliedCreditKobo: koboSchema,
  schedule: z.array(loanInstalmentSchema).min(1),
});
export type TermLoan = z.infer<typeof termLoanSchema>;

export const termLoanListSchema = z.array(termLoanSchema);

export const originatedLoanSchema = z.object({
  loan: termLoanSchema,
  journalEntry: journalEntrySchema,
});
export type OriginatedLoan = z.infer<typeof originatedLoanSchema>;
