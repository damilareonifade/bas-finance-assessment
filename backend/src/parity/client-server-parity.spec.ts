/**
 * Client ⇄ server parity, offline — part of the one-command `npm test`.
 *
 * The browser has its own money kernel (frontend/src/lib/money) for previews; the server has its own domain code, which is
 * what posts. They are separate implementations on purpose (neither side imports the other in the app), so the brief asks
 * for proof they agree. This test imports BOTH and compares them kobo for kobo over generated cases. The same comparison
 * also runs against the live HTTP API in frontend/src/test/contract.live.test.ts (`npm run test:contract`).
 */
import * as client from '../../../frontend/src/lib/money';
import { asKobo } from '../common/money';
import { calculateAdvance, calculateDiscountFeeKobo, calculateLatePenaltyKobo, calculateSettlement } from '../invoice-financing/domain/invoice-financing';
import { buildSchedule, calculateInstalmentKobo, sumInterestKobo } from '../term-loans/domain/term-loan-schedule';

const CASES = 250;

/** Deterministic, so a failure names a reproducible case (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The brief's ranges: principal ₦1,000–₦5,000,000,000; rate 0.5%–60% with fractional values; term 1–60 months. */
function generatedLoans(): Array<{ principalKobo: number; annualRatePercent: number; termMonths: number }> {
  const random = seededRandom(20261111);
  const loans = Array.from({ length: CASES }, () => ({
    principalKobo: 100_000 + Math.floor(random() * (500_000_000_000 - 100_000 + 1)),
    annualRatePercent: Math.round((0.5 + random() * 59.5) * 1000) / 1000,
    termMonths: 1 + Math.floor(random() * 60),
  }));
  // The edges themselves, and the golden example.
  return [
    ...loans,
    { principalKobo: 100_000, annualRatePercent: 0.5, termMonths: 1 },
    { principalKobo: 500_000_000_000, annualRatePercent: 60, termMonths: 60 },
    { principalKobo: 100_000, annualRatePercent: 60, termMonths: 60 },
    { principalKobo: 500_000_000_000, annualRatePercent: 0.5, termMonths: 1 },
    { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 },
  ];
}

/** Each side brands its own Kobo type; parity compares the integers underneath. */
const same = (serverKobo: number, clientKobo: number): boolean => serverKobo === clientKobo;

const rows = (schedule: ReadonlyArray<{ paymentKobo: number; interestKobo: number; principalKobo: number; closingBalanceKobo: number }>) =>
  schedule.map(({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }) => [paymentKobo, interestKobo, principalKobo, closingBalanceKobo]);

describe('client ⇄ server parity (both implementations, same inputs)', () => {
  it(`term loan schedules agree kobo for kobo over ${CASES}+ generated loans`, () => {
    const mismatches: string[] = [];
    for (const loan of generatedLoans()) {
      const server = { principalKobo: asKobo(loan.principalKobo), annualRatePercent: loan.annualRatePercent, termMonths: loan.termMonths };
      const browser = { principalKobo: client.asKobo(loan.principalKobo), annualRatePercent: loan.annualRatePercent, termMonths: loan.termMonths };
      const serverSchedule = buildSchedule(server);
      const clientSchedule = client.buildAmortisationSchedule(browser);
      const agrees =
        same(calculateInstalmentKobo(server), client.calculateMonthlyInstalmentKobo(browser)) &&
        same(sumInterestKobo(serverSchedule), client.sumInterestKobo(clientSchedule)) &&
        JSON.stringify(rows(serverSchedule)) === JSON.stringify(rows(clientSchedule));
      if (!agrees) mismatches.push(JSON.stringify(loan));
    }
    expect(mismatches).toEqual([]);
  });

  it('the golden example is the same on both sides', () => {
    const terms = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };
    const serverSchedule = buildSchedule({ ...terms, principalKobo: asKobo(terms.principalKobo) });
    const clientSchedule = client.buildAmortisationSchedule({ ...terms, principalKobo: client.asKobo(terms.principalKobo) });
    expect(rows(clientSchedule)).toEqual(rows(serverSchedule));
    expect(serverSchedule.at(-1)).toMatchObject({ paymentKobo: 21_063_024, closingBalanceKobo: 0 });
    expect(sumInterestKobo(serverSchedule)).toBe(6_378_154);
  });

  it(`invoice advance, fee, penalty and settlement agree over ${CASES} generated invoices`, () => {
    const random = seededRandom(7);
    const mismatches: string[] = [];
    for (let caseNumber = 0; caseNumber < CASES; caseNumber += 1) {
      const faceValueKobo = 100 + Math.floor(random() * 500_000_000_000);
      const tenorDays = 1 + Math.floor(random() * 365);
      const daysOverdue = Math.floor(random() * 400);
      const { advanceKobo } = calculateAdvance(asKobo(faceValueKobo));
      const server = { advance: calculateAdvance(asKobo(faceValueKobo)), fee: calculateDiscountFeeKobo(advanceKobo, tenorDays), penalty: calculateLatePenaltyKobo(advanceKobo, daysOverdue),
        settlement: calculateSettlement({ faceValueKobo: asKobo(faceValueKobo), tenorDays, daysOverdue }) };
      const clientAdvance = client.calculateInvoiceAdvance(client.asKobo(faceValueKobo));
      const clientSettlement = client.calculateInvoiceSettlement({ faceValueKobo: client.asKobo(faceValueKobo), tenorDays, daysOverdue });
      const agrees =
        same(server.advance.advanceKobo, clientAdvance.advanceKobo) &&
        same(server.advance.reserveKobo, clientAdvance.reserveKobo) &&
        same(server.fee, client.calculateDiscountFeeKobo(clientAdvance.advanceKobo, tenorDays)) &&
        same(server.penalty, client.calculateLatePenaltyKobo(clientAdvance.advanceKobo, daysOverdue)) &&
        same(server.settlement.totalChargesKobo, clientSettlement.totalChargesKobo) &&
        same(server.settlement.clientReceivesKobo, clientSettlement.clientReceivesKobo) &&
        same(server.settlement.clientOwesKobo, clientSettlement.clientOwesKobo);
      if (!agrees) mismatches.push(JSON.stringify({ faceValueKobo, tenorDays, daysOverdue }));
    }
    expect(mismatches).toEqual([]);
  });
});
