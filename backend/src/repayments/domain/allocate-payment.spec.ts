import { asKobo, Kobo } from '../../common/money';
import { allocatePayment, AllocatableInstalment } from './allocate-payment';

function instalment(number: number, parts: Partial<Record<'penalty' | 'fee' | 'interest' | 'principal', number>>): AllocatableInstalment {
  return {
    instalmentNumber: number,
    outstanding: {
      penaltyKobo: asKobo(parts.penalty ?? 0),
      feeKobo: asKobo(parts.fee ?? 0),
      interestKobo: asKobo(parts.interest ?? 0),
      principalKobo: asKobo(parts.principal ?? 0),
    },
  };
}

const total = (allocation: ReturnType<typeof allocatePayment>): number =>
  allocation.allocations.reduce((sum, row) => sum + row.penaltyKobo + row.feeKobo + row.interestKobo + row.principalKobo, 0) + allocation.unappliedCreditKobo;

describe('payment allocation waterfall', () => {
  const owing = [instalment(1, { penalty: 50, fee: 30, interest: 100, principal: 400 }), instalment(2, { interest: 90, principal: 410 })];

  it('pays penalty → fee → interest → principal inside an instalment', () => {
    const result = allocatePayment(asKobo(160), owing);
    expect(result.allocations).toEqual([{ instalmentNumber: 1, penaltyKobo: 50, feeKobo: 30, interestKobo: 80, principalKobo: 0 }]);
    expect(result.unappliedCreditKobo).toBe(0);
  });

  it('clears the oldest instalment before touching the next', () => {
    const result = allocatePayment(asKobo(600), owing);
    expect(result.allocations[0]).toEqual({ instalmentNumber: 1, penaltyKobo: 50, feeKobo: 30, interestKobo: 100, principalKobo: 400 });
    expect(result.allocations[1]).toEqual({ instalmentNumber: 2, penaltyKobo: 0, feeKobo: 0, interestKobo: 20, principalKobo: 0 });
  });

  it('puts the surplus into unapplied customer credit after everything owed is cleared', () => {
    const result = allocatePayment(asKobo(1_500), owing);
    expect(result.unappliedCreditKobo).toBe(1_500 - (50 + 30 + 100 + 400 + 90 + 410));
    expect(result.unappliedCreditKobo).toBe(420);
  });

  it('turns the whole payment into credit when nothing is owed', () => {
    const result = allocatePayment(asKobo(777), []);
    expect(result.allocations).toEqual([]);
    expect(result.unappliedCreditKobo).toBe(777);
  });

  it('never loses or invents a kobo', () => {
    for (const amount of [1, 99, 180, 181, 679, 1_000, 5_000]) {
      expect(total(allocatePayment(amount as Kobo, owing))).toBe(amount);
    }
  });

  it('skips already-paid instalments', () => {
    const result = allocatePayment(asKobo(100), [instalment(1, {}), instalment(2, { interest: 60, principal: 40 })]);
    expect(result.allocations.map((row) => row.instalmentNumber)).toEqual([2]);
  });
});
