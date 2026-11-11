import { z } from 'zod';
import { journalEntrySchema } from '@/features/ledger';
import { isCalendarDate } from '@/lib/dates/calendarDate';
import { koboSchema, parseNairaInputToKobo } from '@/lib/money';

export const repaymentFormSchema = z
  .object({
    amountInput: z.string().trim().min(1, 'Enter the payment amount'),
    paymentDateInput: z.string().trim().min(1, 'Choose the payment date'),
  })
  .transform((values, context) => {
    const amountKobo = parseNairaInputToKobo(values.amountInput);
    if (amountKobo === null || amountKobo <= 0) {
      context.addIssue({ code: 'custom', path: ['amountInput'], message: 'Enter a valid amount greater than ₦0 (max 2 decimals)' });
    }
    if (!isCalendarDate(values.paymentDateInput)) {
      context.addIssue({ code: 'custom', path: ['paymentDateInput'], message: 'Enter a valid date (YYYY-MM-DD)' });
    }
    if (amountKobo === null || context.issues.length > 0) return z.NEVER;
    return { amountKobo, paymentDate: values.paymentDateInput };
  });

export type RepaymentFormInput = z.input<typeof repaymentFormSchema>;
export type RepaymentRequest = z.output<typeof repaymentFormSchema>;

export const REPAYMENT_SERVER_FIELD_MAP = {
  amountKobo: 'amountInput',
  paymentDate: 'paymentDateInput',
} as const satisfies Record<string, keyof RepaymentFormInput>;

export const instalmentAllocationSchema = z.object({
  instalmentNumber: z.number().int().positive(),
  penaltyKobo: koboSchema,
  feeKobo: koboSchema,
  interestKobo: koboSchema,
  principalKobo: koboSchema,
});
export type InstalmentAllocation = z.infer<typeof instalmentAllocationSchema>;

/** Computed by the server (oldest due instalment first; penalty → fee → interest → principal; surplus → unapplied credit). */
export const repaymentAllocationSchema = z.object({
  receivedKobo: koboSchema,
  allocations: z.array(instalmentAllocationSchema),
  unappliedCreditKobo: koboSchema,
});
export type RepaymentAllocation = z.infer<typeof repaymentAllocationSchema>;

export const confirmedRepaymentSchema = z.object({
  repaymentId: z.string(),
  allocation: repaymentAllocationSchema,
  journalEntry: journalEntrySchema,
});
export type ConfirmedRepayment = z.infer<typeof confirmedRepaymentSchema>;
