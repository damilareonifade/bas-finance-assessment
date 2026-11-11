import { z } from 'zod';
import { journalEntrySchema } from '@/features/ledger';
import { daysBetween, isCalendarDate, type CalendarDate } from '@/lib/dates/calendarDate';
import { koboSchema, parseNairaInputToKobo } from '@/lib/money';

/* ---------- Forms ---------- */

export const invoiceFormSchema = z
  .object({
    faceValueInput: z.string().trim().min(1, 'Enter the invoice face value'),
    issueDateInput: z.string().trim().min(1, 'Choose the advance date'),
    dueDateInput: z.string().trim().min(1, 'Choose the due date'),
    customerIdInput: z.string(),
    loanProductIdInput: z.string(),
  })
  .transform((values, context) => {
    const faceValueKobo = parseNairaInputToKobo(values.faceValueInput);
    if (faceValueKobo === null || faceValueKobo <= 0) {
      context.addIssue({ code: 'custom', path: ['faceValueInput'], message: 'Enter a valid amount greater than ₦0 (max 2 decimals)' });
    }
    const isIssueDateValid = isCalendarDate(values.issueDateInput);
    const isDueDateValid = isCalendarDate(values.dueDateInput);
    if (!isIssueDateValid) context.addIssue({ code: 'custom', path: ['issueDateInput'], message: 'Enter a valid date' });
    if (!isDueDateValid) context.addIssue({ code: 'custom', path: ['dueDateInput'], message: 'Enter a valid date' });
    if (isIssueDateValid && isDueDateValid && daysBetween(values.issueDateInput, values.dueDateInput) <= 0) {
      context.addIssue({ code: 'custom', path: ['dueDateInput'], message: 'Due date must be after the advance date' });
    }
    if (faceValueKobo === null || context.issues.length > 0) return z.NEVER;
    return {
      faceValueKobo,
      issueDate: values.issueDateInput as CalendarDate,
      dueDate: values.dueDateInput as CalendarDate,
      customerId: values.customerIdInput === '' ? undefined : values.customerIdInput,
      loanProductId: values.loanProductIdInput === '' ? undefined : values.loanProductIdInput,
    };
  });
export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceRequest = z.output<typeof invoiceFormSchema>;

/** Server field → the label on screen, for error messages. */
export const INVOICE_FIELD_LABELS: Readonly<Record<string, string>> = {
  faceValueKobo: 'Invoice face value',
  issueDate: 'Advance date',
  dueDate: 'Due date',
  customerId: 'Customer',
  loanProductId: 'Loan product',
};

export const INVOICE_SERVER_FIELD_MAP = {
  faceValueKobo: 'faceValueInput',
  issueDate: 'issueDateInput',
  dueDate: 'dueDateInput',
  customerId: 'customerIdInput',
  loanProductId: 'loanProductIdInput',
} as const satisfies Record<string, keyof InvoiceFormInput>;

export const settlementFormSchema = z
  .object({ settlementDateInput: z.string().trim().min(1, 'Choose the date the debtor paid') })
  .transform((values, context) => {
    if (!isCalendarDate(values.settlementDateInput)) {
      context.addIssue({ code: 'custom', path: ['settlementDateInput'], message: 'Enter a valid date' });
      return z.NEVER;
    }
    return { settlementDate: values.settlementDateInput as CalendarDate };
  });
export type SettlementFormInput = z.input<typeof settlementFormSchema>;
export type SettlementRequest = z.output<typeof settlementFormSchema>;

export const SETTLEMENT_SERVER_FIELD_MAP = { settlementDate: 'settlementDateInput' } as const satisfies Record<string, keyof SettlementFormInput>;

/* ---------- Responses ---------- */

export const invoiceQuoteSchema = z.object({
  tenorDays: z.number().int().positive(),
  advanceKobo: koboSchema,
  reserveKobo: koboSchema,
  discountFeeKobo: koboSchema,
  latePenaltyPerDayKobo: koboSchema,
});
export type InvoiceQuote = z.infer<typeof invoiceQuoteSchema>;

export const invoiceSchema = z.object({
  invoiceId: z.string(),
  customerId: z.string().nullable(),
  loanProductId: z.string().nullable(),
  faceValueKobo: koboSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  tenorDays: z.number().int().positive(),
  advanceKobo: koboSchema,
  reserveKobo: koboSchema,
  discountFeeKobo: koboSchema,
  status: z.enum(['ADVANCED', 'SETTLED']),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const financedInvoiceSchema = z.object({ invoice: invoiceSchema, journalEntry: journalEntrySchema });
export type FinancedInvoice = z.infer<typeof financedInvoiceSchema>;

export const invoiceSettlementSchema = z.object({
  daysOverdue: z.number().int().nonnegative(),
  discountFeeKobo: koboSchema,
  latePenaltyKobo: koboSchema,
  totalChargesKobo: koboSchema,
  clientReceivesKobo: koboSchema,
  /** Shortfall the client owes when charges exceed the reserve. */
  clientOwesKobo: koboSchema,
  journalEntry: journalEntrySchema,
});
export type InvoiceSettlement = z.infer<typeof invoiceSettlementSchema>;
