import { asKobo } from '../../common/money';
import { credit, debit, prepareLinesForPosting, reverseLines } from './journal';

describe('journal posting rules', () => {
  it('accepts a balanced entry', () => {
    const lines = prepareLinesForPosting([debit('LOANS_RECEIVABLE', asKobo(500)), credit('CASH', asKobo(500))]);
    expect(lines).toHaveLength(2);
  });

  it('does not post zero-amount lines', () => {
    const lines = prepareLinesForPosting([
      debit('CASH', asKobo(100)),
      credit('LOANS_RECEIVABLE', asKobo(100)),
      credit('INTEREST_INCOME', asKobo(0)),
      credit('UNAPPLIED_CREDIT', asKobo(0)),
    ]);
    expect(lines.map((line) => line.account)).toEqual(['CASH', 'LOANS_RECEIVABLE']);
  });

  it('rejects an unbalanced entry', () => {
    expect(() => prepareLinesForPosting([debit('CASH', asKobo(100)), credit('LOANS_RECEIVABLE', asKobo(99))])).toThrow(/not balanced/);
  });

  it('rejects an entry with fewer than two non-zero lines', () => {
    expect(() => prepareLinesForPosting([debit('CASH', asKobo(100)), credit('LOANS_RECEIVABLE', asKobo(0))])).toThrow(/at least two/);
  });

  it('reverses by swapping sides, and the reversal itself balances', () => {
    const original = [debit('CASH', asKobo(100)), credit('LOANS_RECEIVABLE', asKobo(60)), credit('INTEREST_INCOME', asKobo(40))];
    const reversed = reverseLines(original);
    expect(reversed[0]).toMatchObject({ account: 'CASH', debitKobo: 0, creditKobo: 100 });
    expect(() => prepareLinesForPosting(reversed)).not.toThrow();
  });
});
