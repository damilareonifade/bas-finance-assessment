import { addKobo, Kobo, subtractKobo, ZERO_KOBO } from '../../common/money';
import { ACCOUNT_CODES, ACCOUNT_TYPES, AccountCode, AccountType } from './account';

/** One posted line, with the entry it belongs to. Pure data — this module never touches storage. */
export interface LedgerLineInput {
  readonly entryId: string;
  readonly account: AccountCode;
  readonly debitKobo: Kobo;
  readonly creditKobo: Kobo;
}

export interface AccountSummary {
  readonly account: AccountCode;
  readonly type: AccountType;
  readonly debitKobo: Kobo;
  readonly creditKobo: Kobo;
  /**
   * Balance on the account's normal side: debits − credits for assets, credits − debits for income and liabilities.
   * Negative means the account sits on its unusual side for this scope (e.g. more cash paid out to a customer than received).
   */
  readonly balanceKobo: Kobo;
}

export interface LedgerTotals {
  readonly debitKobo: Kobo;
  readonly creditKobo: Kobo;
  readonly entryCount: number;
  readonly lineCount: number;
  /** Double entry holds for any set of whole entries: Σ debits = Σ credits. */
  readonly isBalanced: boolean;
}

/** Where a customer stands with the lender, read straight off their ledger. */
export interface CustomerPosition {
  /** Loans Receivable + Invoice Receivables + Client Receivable: what the customer still owes. */
  readonly owedByCustomerKobo: Kobo;
  /** Client Payable + Unapplied Credit: what the lender holds for, or owes to, the customer. */
  readonly owedToCustomerKobo: Kobo;
  /** Interest + fee + penalty income collected from the customer. */
  readonly incomeEarnedKobo: Kobo;
  /** Cash received from the customer minus cash paid out to them. */
  readonly netCashKobo: Kobo;
}

const NORMALLY_DEBIT: ReadonlySet<AccountType> = new Set(['ASSET']);

/** Per-account totals in chart-of-accounts order; accounts with no lines in scope are left out. */
export function summariseAccounts(lines: readonly LedgerLineInput[]): AccountSummary[] {
  return ACCOUNT_CODES.flatMap((account) => {
    const own = lines.filter((line) => line.account === account);
    if (own.length === 0) return [];
    const debitKobo = addKobo(...own.map((line) => line.debitKobo));
    const creditKobo = addKobo(...own.map((line) => line.creditKobo));
    const type = ACCOUNT_TYPES[account];
    return [{ account, type, debitKobo, creditKobo, balanceKobo: NORMALLY_DEBIT.has(type) ? subtractKobo(debitKobo, creditKobo) : subtractKobo(creditKobo, debitKobo) }];
  });
}

export function ledgerTotals(lines: readonly LedgerLineInput[]): LedgerTotals {
  const debitKobo = addKobo(ZERO_KOBO, ...lines.map((line) => line.debitKobo));
  const creditKobo = addKobo(ZERO_KOBO, ...lines.map((line) => line.creditKobo));
  return { debitKobo, creditKobo, entryCount: new Set(lines.map((line) => line.entryId)).size, lineCount: lines.length, isBalanced: debitKobo === creditKobo };
}

export function customerPosition(accounts: readonly AccountSummary[]): CustomerPosition {
  const balance = (account: AccountCode): Kobo => accounts.find((summary) => summary.account === account)?.balanceKobo ?? ZERO_KOBO;
  return {
    owedByCustomerKobo: addKobo(balance('LOANS_RECEIVABLE'), balance('INVOICE_RECEIVABLES'), balance('CLIENT_RECEIVABLE')),
    owedToCustomerKobo: addKobo(balance('CLIENT_PAYABLE'), balance('UNAPPLIED_CREDIT')),
    incomeEarnedKobo: addKobo(balance('INTEREST_INCOME'), balance('FEE_INCOME'), balance('PENALTY_INCOME')),
    netCashKobo: balance('CASH'),
  };
}
