import { describe, expect, it } from 'vitest';
import {
  asKobo,
  buildAmortisationSchedule,
  calculateMonthlyInstalmentKobo,
  MAX_ANNUAL_RATE_PERCENT,
  MAX_PRINCIPAL_KOBO,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL_KOBO,
  sumInterestKobo,
  type TermLoanTerms,
} from '..';

const GOLDEN_TERMS: TermLoanTerms = { principalKobo: asKobo(120_000_000), annualRatePercent: 18, termMonths: 6 };

const GOLDEN_SCHEDULE = [
  { instalmentNumber: 1, paymentKobo: 21_063_026, interestKobo: 1_800_000, principalKobo: 19_263_026, closingBalanceKobo: 100_736_974 },
  { instalmentNumber: 2, paymentKobo: 21_063_026, interestKobo: 1_511_055, principalKobo: 19_551_971, closingBalanceKobo: 81_185_003 },
  { instalmentNumber: 3, paymentKobo: 21_063_026, interestKobo: 1_217_775, principalKobo: 19_845_251, closingBalanceKobo: 61_339_752 },
  { instalmentNumber: 4, paymentKobo: 21_063_026, interestKobo: 920_096, principalKobo: 20_142_930, closingBalanceKobo: 41_196_822 },
  { instalmentNumber: 5, paymentKobo: 21_063_026, interestKobo: 617_952, principalKobo: 20_445_074, closingBalanceKobo: 20_751_748 },
  { instalmentNumber: 6, paymentKobo: 21_063_024, interestKobo: 311_276, principalKobo: 20_751_748, closingBalanceKobo: 0 },
];

/** Small deterministic PRNG (mulberry32) so generated cases are reproducible. */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function generateTerms(caseCount: number): TermLoanTerms[] {
  const random = createSeededRandom(20_26);
  return Array.from({ length: caseCount }, () => {
    const principalSpan = MAX_PRINCIPAL_KOBO - MIN_PRINCIPAL_KOBO;
    return {
      principalKobo: asKobo(MIN_PRINCIPAL_KOBO + Math.floor(random() * principalSpan)),
      annualRatePercent: Math.round((MIN_ANNUAL_RATE_PERCENT + random() * (MAX_ANNUAL_RATE_PERCENT - MIN_ANNUAL_RATE_PERCENT)) * 100) / 100,
      termMonths: 1 + Math.floor(random() * MAX_TERM_MONTHS),
    };
  });
}

describe('term loan — golden example 1', () => {
  it('computes the instalment 21,063,026 kobo', () => {
    expect(calculateMonthlyInstalmentKobo(GOLDEN_TERMS)).toBe(21_063_026);
  });

  it('matches every schedule row to the kobo', () => {
    expect(buildAmortisationSchedule(GOLDEN_TERMS)).toEqual(GOLDEN_SCHEDULE);
  });

  it('totals interest of 6,378,154 kobo', () => {
    expect(sumInterestKobo(buildAmortisationSchedule(GOLDEN_TERMS))).toBe(6_378_154);
  });
});

describe('term loan — invariants over 300 generated cases', () => {
  const generatedCases = generateTerms(300);

  it.each(generatedCases.map((terms, index) => [index, terms] as const))('case %i holds', (_index, terms) => {
    const schedule = buildAmortisationSchedule(terms);
    const regularInstalmentKobo = calculateMonthlyInstalmentKobo(terms);
    const principalPaidKobo = schedule.reduce((total, row) => total + row.principalKobo, 0);

    expect(schedule).toHaveLength(terms.termMonths);
    expect(principalPaidKobo).toBe(terms.principalKobo);
    expect(schedule.at(-1)?.closingBalanceKobo).toBe(0);

    schedule.forEach((row, rowIndex) => {
      expect(Number.isSafeInteger(row.paymentKobo)).toBe(true);
      expect(row.paymentKobo).toBe(row.principalKobo + row.interestKobo);
      expect(row.principalKobo).toBeGreaterThan(0);
      if (rowIndex < schedule.length - 1) expect(row.paymentKobo).toBe(regularInstalmentKobo);
    });
  });
});

describe('term loan — boundaries', () => {
  it('handles a 1-month term: pays principal plus one month of interest', () => {
    const [onlyInstalment] = buildAmortisationSchedule({ principalKobo: asKobo(100_000), annualRatePercent: 12, termMonths: 1 });
    expect(onlyInstalment).toMatchObject({ principalKobo: 100_000, interestKobo: 1_000, paymentKobo: 101_000, closingBalanceKobo: 0 });
  });

  it('handles the maximum principal, rate and term without losing integers', () => {
    const schedule = buildAmortisationSchedule({
      principalKobo: MAX_PRINCIPAL_KOBO,
      annualRatePercent: MAX_ANNUAL_RATE_PERCENT,
      termMonths: MAX_TERM_MONTHS,
    });
    expect(schedule).toHaveLength(60);
    expect(schedule.at(-1)?.closingBalanceKobo).toBe(0);
  });

  it('handles the minimum principal and rate', () => {
    const schedule = buildAmortisationSchedule({ principalKobo: MIN_PRINCIPAL_KOBO, annualRatePercent: 0.5, termMonths: 60 });
    expect(schedule.at(-1)?.closingBalanceKobo).toBe(0);
  });

  it('rounds an exact .5 kobo of interest up (half-up)', () => {
    // 100,050 kobo × 1% monthly = 1,000.5 kobo → 1,001
    const [firstInstalment] = buildAmortisationSchedule({ principalKobo: asKobo(100_050), annualRatePercent: 12, termMonths: 2 });
    expect(firstInstalment?.interestKobo).toBe(1_001);
  });
});
