import { describe, expect, it } from 'vitest';
import { asKobo } from '@/lib/money';
import type { StatementLine } from '../schemas/statement';
import { buildStatementRows, calculateScheduleOutstandingPrincipalKobo, calculateTieOut, statementClosingBalanceKobo } from '../statementMath';

function line(overrides: Partial<StatementLine> & Pick<StatementLine, 'account'>): StatementLine {
  return { entryId: 'E1', postedOn: '2026-01-01', event: 'Event', debitKobo: asKobo(0), creditKobo: asKobo(0), ...overrides };
}

describe('statement running principal balance', () => {
  const lines: StatementLine[] = [
    line({ entryId: 'E1', account: 'LOANS_RECEIVABLE', debitKobo: asKobo(120_000_000) }),
    line({ entryId: 'E1', account: 'CASH', creditKobo: asKobo(120_000_000) }),
    line({ entryId: 'E2', account: 'CASH', debitKobo: asKobo(21_063_026) }),
    line({ entryId: 'E2', account: 'LOANS_RECEIVABLE', creditKobo: asKobo(19_263_026) }),
    line({ entryId: 'E2', account: 'INTEREST_INCOME', creditKobo: asKobo(1_800_000) }),
  ];

  it('moves only on Loans Receivable lines (debits minus credits)', () => {
    expect(buildStatementRows(lines).map((row) => row.runningPrincipalBalanceKobo)).toEqual([
      120_000_000, 120_000_000, 120_000_000, 100_736_974, 100_736_974,
    ]);
  });

  it('closes at the last running balance, or 0 for an empty statement', () => {
    expect(statementClosingBalanceKobo(buildStatementRows(lines))).toBe(100_736_974);
    expect(statementClosingBalanceKobo([])).toBe(0);
  });
});

describe('tie-out', () => {
  it('sums scheduled principal minus principal paid', () => {
    expect(
      calculateScheduleOutstandingPrincipalKobo([
        { principalKobo: asKobo(19_263_026), principalPaidKobo: asKobo(19_263_026) },
        { principalKobo: asKobo(19_551_971), principalPaidKobo: asKobo(0) },
      ]),
    ).toBe(19_551_971);
  });

  it('ties out when balances are equal', () => {
    expect(calculateTieOut(asKobo(100), asKobo(100))).toEqual({ isTiedOut: true, differenceKobo: 0 });
  });

  it('reports the difference when they disagree', () => {
    expect(calculateTieOut(asKobo(105), asKobo(100))).toEqual({ isTiedOut: false, differenceKobo: 5 });
  });
});
