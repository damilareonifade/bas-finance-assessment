import { asKobo, Kobo } from '../../common/money';
import { AccountCode } from './account';
import { customerPosition, LedgerLineInput, ledgerTotals, summariseAccounts } from './ledger-summary';

const line = (entryId: string, account: AccountCode, debit: number, credit: number): LedgerLineInput => ({
  entryId,
  account,
  debitKobo: asKobo(debit) as Kobo,
  creditKobo: asKobo(credit) as Kobo,
});

// Golden term loan: disburse 120,000,000; first instalment 21,063,026 = 1,800,000 interest + 19,263,026 principal.
// Golden invoice settled 96 days late: shortfall 94,247 owed by the client.
const book: LedgerLineInput[] = [
  line('JE-1', 'LOANS_RECEIVABLE', 120_000_000, 0),
  line('JE-1', 'CASH', 0, 120_000_000),
  line('JE-2', 'CASH', 21_063_026, 0),
  line('JE-2', 'LOANS_RECEIVABLE', 0, 19_263_026),
  line('JE-2', 'INTEREST_INCOME', 0, 1_800_000),
  line('JE-3', 'INVOICE_RECEIVABLES', 80_000_000, 0),
  line('JE-3', 'CASH', 0, 80_000_000),
  line('JE-4', 'CASH', 100_000_000, 0),
  line('JE-4', 'CLIENT_RECEIVABLE', 94_247, 0),
  line('JE-4', 'INVOICE_RECEIVABLES', 0, 80_000_000),
  line('JE-4', 'FEE_INCOME', 0, 4_734_247),
  line('JE-4', 'PENALTY_INCOME', 0, 15_360_000),
];

describe('ledger summary', () => {
  it('totals balance for whole entries, and counts entries and lines', () => {
    expect(ledgerTotals(book)).toEqual({ debitKobo: 321_157_273, creditKobo: 321_157_273, entryCount: 4, lineCount: 12, isBalanced: true });
    expect(ledgerTotals(book.slice(0, 3)).isBalanced).toBe(false); // half an entry never balances
    expect(ledgerTotals([])).toEqual({ debitKobo: 0, creditKobo: 0, entryCount: 0, lineCount: 0, isBalanced: true });
  });

  it('reports each account on its normal side, in chart-of-accounts order, leaving unused accounts out', () => {
    expect(summariseAccounts(book)).toEqual([
      { account: 'CASH', type: 'ASSET', debitKobo: 121_063_026, creditKobo: 200_000_000, balanceKobo: -78_936_974 },
      { account: 'LOANS_RECEIVABLE', type: 'ASSET', debitKobo: 120_000_000, creditKobo: 19_263_026, balanceKobo: 100_736_974 },
      { account: 'INVOICE_RECEIVABLES', type: 'ASSET', debitKobo: 80_000_000, creditKobo: 80_000_000, balanceKobo: 0 },
      { account: 'CLIENT_RECEIVABLE', type: 'ASSET', debitKobo: 94_247, creditKobo: 0, balanceKobo: 94_247 },
      { account: 'INTEREST_INCOME', type: 'INCOME', debitKobo: 0, creditKobo: 1_800_000, balanceKobo: 1_800_000 },
      { account: 'FEE_INCOME', type: 'INCOME', debitKobo: 0, creditKobo: 4_734_247, balanceKobo: 4_734_247 },
      { account: 'PENALTY_INCOME', type: 'INCOME', debitKobo: 0, creditKobo: 15_360_000, balanceKobo: 15_360_000 },
    ]);
  });

  it("reads the customer's position off the account balances", () => {
    expect(customerPosition(summariseAccounts(book))).toEqual({
      owedByCustomerKobo: 100_736_974 + 94_247, // principal outstanding + invoice shortfall
      owedToCustomerKobo: 0,
      incomeEarnedKobo: 1_800_000 + 4_734_247 + 15_360_000,
      netCashKobo: -78_936_974, // paid out more than received so far
    });
  });
});
