import { z } from 'zod';
import { koboSchema } from '@/lib/money';
import { accountCodeSchema } from './ledger';

export const ledgerSearchResultSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  matchedOn: z.string().nullable(),
});
export type LedgerSearchResult = z.infer<typeof ledgerSearchResultSchema>;

const productRefSchema = z.object({ productId: z.string(), name: z.string() });

export const ledgerLineSchema = z.object({
  entryId: z.string(),
  postedOn: z.string(),
  event: z.string(),
  reversesEntryId: z.string().nullable(),
  account: accountCodeSchema,
  debitKobo: koboSchema,
  creditKobo: koboSchema,
  customer: z.object({ customerId: z.string(), fullName: z.string() }).nullable(),
  facility: z.object({ kind: z.enum(['LOAN', 'INVOICE']), id: z.string() }).nullable(),
  product: productRefSchema.nullable(),
});
export type LedgerLine = z.infer<typeof ledgerLineSchema>;

export const ledgerAccountSummarySchema = z.object({
  account: accountCodeSchema,
  type: z.enum(['ASSET', 'INCOME', 'LIABILITY']),
  debitKobo: koboSchema,
  creditKobo: koboSchema,
  /** On the account's normal side; may be negative. */
  balanceKobo: koboSchema,
});
export type LedgerAccountSummary = z.infer<typeof ledgerAccountSummarySchema>;

export const ledgerProductSummarySchema = z.object({
  product: productRefSchema.nullable(),
  debitKobo: koboSchema,
  creditKobo: koboSchema,
  entryCount: z.number().int(),
});
export type LedgerProductSummary = z.infer<typeof ledgerProductSummarySchema>;

export const ledgerViewSchema = z.object({
  customer: z
    .object({
      customerId: z.string(),
      fullName: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      assignedOfficer: z.object({ userId: z.string(), fullName: z.string() }).nullable(),
    })
    .nullable(),
  product: z.object({ productId: z.string(), name: z.string(), type: z.string() }).nullable(),
  period: z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  totals: z.object({ debitKobo: koboSchema, creditKobo: koboSchema, entryCount: z.number().int(), lineCount: z.number().int(), isBalanced: z.boolean() }),
  accounts: z.array(ledgerAccountSummarySchema),
  products: z.array(ledgerProductSummarySchema),
  position: z.object({ owedByCustomerKobo: koboSchema, owedToCustomerKobo: koboSchema, incomeEarnedKobo: koboSchema, netCashKobo: koboSchema }).nullable(),
  lines: z.array(ledgerLineSchema),
  truncated: z.boolean(),
});
export type LedgerView = z.infer<typeof ledgerViewSchema>;

/** The ledger page's filters — they live in the URL so a view can be shared or bookmarked. */
export interface LedgerFilter {
  readonly customerId?: string;
  readonly loanProductId?: string;
  readonly from?: string;
  readonly to?: string;
}

export const ACCOUNT_TYPE_LABELS: Readonly<Record<LedgerAccountSummary['type'], string>> = { ASSET: 'Asset', INCOME: 'Income', LIABILITY: 'Liability' };
