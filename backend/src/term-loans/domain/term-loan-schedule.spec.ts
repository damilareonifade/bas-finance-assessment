import { asKobo } from '../../common/money';
import {
  MAX_ANNUAL_RATE_PERCENT,
  MAX_PRINCIPAL_KOBO,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL_KOBO,
} from '../../common/money/limits';
import { asCalendarDate } from '../../common/dates/calendar-date';
import { buildSchedule, calculateInstalmentKobo, dueDateForInstalment, sumInterestKobo, TermLoanTerms } from './term-loan-schedule';

const GOLDEN_TERMS: TermLoanTerms = { principalKobo: asKobo(120_000_000), annualRatePercent: 18, termMonths: 6 };

const GOLDEN_SCHEDULE = [
  { instalmentNumber: 1, paymentKobo: 21_063_026, interestKobo: 1_800_000, principalKobo: 19_263_026, closingBalanceKobo: 100_736_974 },
  { instalmentNumber: 2, paymentKobo: 21_063_026, interestKobo: 1_511_055, principalKobo: 19_551_971, closingBalanceKobo: 81_185_003 },
  { instalmentNumber: 3, paymentKobo: 21_063_026, interestKobo: 1_217_775, principalKobo: 19_845_251, closingBalanceKobo: 61_339_752 },
  { instalmentNumber: 4, paymentKobo: 21_063_026, interestKobo: 920_096, principalKobo: 20_142_930, closingBalanceKobo: 41_196_822 },
  { instalmentNumber: 5, paymentKobo: 21_063_026, interestKobo: 617_952, principalKobo: 20_445_074, closingBalanceKobo: 20_751_748 },
  { instalmentNumber: 6, paymentKobo: 21_063_024, interestKobo: 311_276, principalKobo: 20_751_748, closingBalanceKobo: 0 },
];

function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('term loan schedule — golden example 1', () => {
  it('computes the instalment 21,063,026 kobo', () => {
    expect(calculateInstalmentKobo(GOLDEN_TERMS)).toBe(21_063_026);
  });

  it('matches every row to the kobo', () => {
    expect(buildSchedule(GOLDEN_TERMS)).toEqual(GOLDEN_SCHEDULE);
  });

  it('totals interest of 6,378,154 kobo', () => {
    expect(sumInterestKobo(buildSchedule(GOLDEN_TERMS))).toBe(6_378_154);
  });
});

describe('term loan schedule — invariants over 300 generated cases', () => {
  const random = createSeededRandom(2026);
  const cases: TermLoanTerms[] = Array.from({ length: 300 }, () => ({
    principalKobo: asKobo(MIN_PRINCIPAL_KOBO + Math.floor(random() * (MAX_PRINCIPAL_KOBO - MIN_PRINCIPAL_KOBO))),
    annualRatePercent: Math.round((MIN_ANNUAL_RATE_PERCENT + random() * (MAX_ANNUAL_RATE_PERCENT - MIN_ANNUAL_RATE_PERCENT)) * 100) / 100,
    termMonths: 1 + Math.floor(random() * MAX_TERM_MONTHS),
  }));

  it.each(cases.map((terms, index) => [index, terms] as const))('case %i', (_index, terms) => {
    const schedule = buildSchedule(terms);
    const regular = calculateInstalmentKobo(terms);
    expect(schedule).toHaveLength(terms.termMonths);
    expect(schedule.reduce((total, row) => total + row.principalKobo, 0)).toBe(terms.principalKobo);
    expect(schedule.at(-1)?.closingBalanceKobo).toBe(0);
    schedule.forEach((row, index) => {
      expect(Number.isSafeInteger(row.paymentKobo)).toBe(true);
      expect(row.paymentKobo).toBe(row.principalKobo + row.interestKobo);
      if (index < schedule.length - 1) expect(row.paymentKobo).toBe(regular);
    });
  });
});

describe('boundaries', () => {
  it('rounds an exact .5 kobo of interest up (half-up)', () => {
    const [first] = buildSchedule({ principalKobo: asKobo(100_050), annualRatePercent: 12, termMonths: 2 });
    expect(first?.interestKobo).toBe(1_001);
  });

  it('handles a 1-month term', () => {
    const [only] = buildSchedule({ principalKobo: asKobo(100_000), annualRatePercent: 12, termMonths: 1 });
    expect(only).toMatchObject({ principalKobo: 100_000, interestKobo: 1_000, paymentKobo: 101_000, closingBalanceKobo: 0 });
  });

  it('clamps due dates to month end', () => {
    expect(dueDateForInstalment(asCalendarDate('2026-01-31'), 1)).toBe('2026-02-28');
    expect(dueDateForInstalment(asCalendarDate('2026-01-31'), 2)).toBe('2026-03-31');
    expect(dueDateForInstalment(asCalendarDate('2024-01-31'), 1)).toBe('2024-02-29');
    expect(dueDateForInstalment(asCalendarDate('2026-11-15'), 3)).toBe('2027-02-15');
  });
});
