import { z } from 'zod';
import { accountCodeSchema } from '@/features/ledger';
import { koboSchema } from '@/lib/money';

export const statementLineSchema = z.object({
  entryId: z.string(),
  postedOn: z.string(),
  event: z.string(),
  account: accountCodeSchema,
  debitKobo: koboSchema,
  creditKobo: koboSchema,
});
export type StatementLine = z.infer<typeof statementLineSchema>;

export const loanStatementSchema = z.object({
  loanId: z.string(),
  lines: z.array(statementLineSchema),
});
export type LoanStatement = z.infer<typeof loanStatementSchema>;
