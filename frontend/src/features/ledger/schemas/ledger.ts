import { z } from 'zod';
import { koboSchema } from '@/lib/money';

export const ACCOUNT_CODES = [
  'CASH',
  'LOANS_RECEIVABLE',
  'INVOICE_RECEIVABLES',
  'CLIENT_RECEIVABLE',
  'INTEREST_INCOME',
  'FEE_INCOME',
  'PENALTY_INCOME',
  'CLIENT_PAYABLE',
  'UNAPPLIED_CREDIT',
] as const;

export const accountCodeSchema = z.enum(ACCOUNT_CODES);
export type AccountCode = z.infer<typeof accountCodeSchema>;

export const ACCOUNT_LABELS: Readonly<Record<AccountCode, string>> = {
  CASH: 'Cash',
  LOANS_RECEIVABLE: 'Loans Receivable',
  INVOICE_RECEIVABLES: 'Invoice Receivables',
  CLIENT_RECEIVABLE: 'Client Receivable',
  INTEREST_INCOME: 'Interest Income',
  FEE_INCOME: 'Fee Income',
  PENALTY_INCOME: 'Penalty Income',
  CLIENT_PAYABLE: 'Client Payable',
  UNAPPLIED_CREDIT: 'Unapplied Credit',
};

export const journalLineSchema = z.object({
  account: accountCodeSchema,
  debitKobo: koboSchema,
  creditKobo: koboSchema,
});
export type JournalLine = z.infer<typeof journalLineSchema>;

export const journalEntrySchema = z.object({
  entryId: z.string(),
  postedOn: z.string(),
  event: z.string(),
  lines: z.array(journalLineSchema).min(2),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;
