import { asKobo } from '../../common/money';
import { prepareLinesForPosting } from '../../ledger/domain/journal';
import { buildSettlementLines, calculateAdvance, calculateDiscountFeeKobo, calculateLatePenaltyKobo, calculateSettlement } from './invoice-financing';

const FACE = asKobo(100_000_000);

describe('invoice financing — visible example', () => {
  it('advance 80,000,000 and reserve 20,000,000', () => {
    expect(calculateAdvance(FACE)).toEqual({ advanceKobo: 80_000_000, reserveKobo: 20_000_000 });
  });

  it('discount fee 4,734,247 (4,734,246.58… half-up) and penalty 160,000/day', () => {
    expect(calculateDiscountFeeKobo(asKobo(80_000_000), 60)).toBe(4_734_247);
    expect(calculateLatePenaltyKobo(asKobo(80_000_000), 1)).toBe(160_000);
  });

  it.each([
    { daysOverdue: 0, penalty: 0, charges: 4_734_247, receives: 15_265_753, owes: 0 },
    { daysOverdue: 95, penalty: 15_200_000, charges: 19_934_247, receives: 65_753, owes: 0 },
    { daysOverdue: 96, penalty: 15_360_000, charges: 20_094_247, receives: 0, owes: 94_247 },
  ])('$daysOverdue days overdue', ({ daysOverdue, penalty, charges, receives, owes }) => {
    const outcome = calculateSettlement({ faceValueKobo: FACE, tenorDays: 60, daysOverdue });
    expect(outcome).toMatchObject({ latePenaltyKobo: penalty, totalChargesKobo: charges, clientReceivesKobo: receives, clientOwesKobo: owes });
  });

  it('posts the exact settlement journal at 96 days overdue (zero Client Payable line dropped)', () => {
    const outcome = calculateSettlement({ faceValueKobo: FACE, tenorDays: 60, daysOverdue: 96 });
    const lines = prepareLinesForPosting(buildSettlementLines(FACE, outcome));
    expect(lines).toEqual([
      { account: 'CASH', debitKobo: 100_000_000, creditKobo: 0 },
      { account: 'CLIENT_RECEIVABLE', debitKobo: 94_247, creditKobo: 0 },
      { account: 'INVOICE_RECEIVABLES', debitKobo: 0, creditKobo: 80_000_000 },
      { account: 'FEE_INCOME', debitKobo: 0, creditKobo: 4_734_247 },
      { account: 'PENALTY_INCOME', debitKobo: 0, creditKobo: 15_360_000 },
    ]);
  });

  it('every settlement balances and is never negative, from on-time to very late', () => {
    for (let daysOverdue = 0; daysOverdue <= 400; daysOverdue += 1) {
      const outcome = calculateSettlement({ faceValueKobo: FACE, tenorDays: 60, daysOverdue });
      expect(outcome.clientReceivesKobo).toBeGreaterThanOrEqual(0);
      expect(outcome.clientOwesKobo).toBeGreaterThanOrEqual(0);
      expect(() => prepareLinesForPosting(buildSettlementLines(FACE, outcome))).not.toThrow();
    }
  });
});
