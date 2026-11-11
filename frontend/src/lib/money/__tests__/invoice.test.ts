import { describe, expect, it } from 'vitest';
import {
  asKobo,
  calculateDiscountFeeKobo,
  calculateInvoiceAdvance,
  calculateInvoiceSettlement,
  calculateLatePenaltyKobo,
} from '..';

const FACE_VALUE_KOBO = asKobo(100_000_000);
const TENOR_DAYS = 60;

describe('invoice financing — visible example', () => {
  it('advances 80% and holds back the reserve', () => {
    expect(calculateInvoiceAdvance(FACE_VALUE_KOBO)).toEqual({ advanceKobo: 80_000_000, reserveKobo: 20_000_000 });
  });

  it('computes the discount fee 4,734,247 (4,734,246.58… rounded half-up)', () => {
    expect(calculateDiscountFeeKobo(asKobo(80_000_000), TENOR_DAYS)).toBe(4_734_247);
  });

  it('computes the late penalty 160,000 kobo per day', () => {
    expect(calculateLatePenaltyKobo(asKobo(80_000_000), 1)).toBe(160_000);
  });

  it.each([
    { daysOverdue: 0, penalty: 0, charges: 4_734_247, receives: 15_265_753, owes: 0 },
    { daysOverdue: 95, penalty: 15_200_000, charges: 19_934_247, receives: 65_753, owes: 0 },
    { daysOverdue: 96, penalty: 15_360_000, charges: 20_094_247, receives: 0, owes: 94_247 },
  ])('settles at $daysOverdue days overdue', ({ daysOverdue, penalty, charges, receives, owes }) => {
    const outcome = calculateInvoiceSettlement({ faceValueKobo: FACE_VALUE_KOBO, tenorDays: TENOR_DAYS, daysOverdue });
    expect(outcome.latePenaltyKobo).toBe(penalty);
    expect(outcome.totalChargesKobo).toBe(charges);
    expect(outcome.clientReceivesKobo).toBe(receives);
    expect(outcome.clientOwesKobo).toBe(owes);
  });

  it('never produces a negative client payable or shortfall', () => {
    for (const daysOverdue of [0, 1, 50, 95, 96, 500]) {
      const outcome = calculateInvoiceSettlement({ faceValueKobo: FACE_VALUE_KOBO, tenorDays: TENOR_DAYS, daysOverdue });
      expect(outcome.clientReceivesKobo).toBeGreaterThanOrEqual(0);
      expect(outcome.clientOwesKobo).toBeGreaterThanOrEqual(0);
      expect(outcome.clientReceivesKobo === 0 || outcome.clientOwesKobo === 0).toBe(true);
    }
  });

  it('balances the settlement journal at 96 days overdue', () => {
    const outcome = calculateInvoiceSettlement({ faceValueKobo: FACE_VALUE_KOBO, tenorDays: TENOR_DAYS, daysOverdue: 96 });
    const debits = FACE_VALUE_KOBO + outcome.clientOwesKobo;
    const credits = outcome.advanceKobo + outcome.discountFeeKobo + outcome.latePenaltyKobo + outcome.clientReceivesKobo;
    expect(debits).toBe(credits);
  });
});
