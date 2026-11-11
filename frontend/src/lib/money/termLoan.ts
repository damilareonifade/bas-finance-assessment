import { addKobo, asKobo, subtractKobo, ZERO_KOBO, type Kobo } from './kobo';
import { MoneyDecimal, roundHalfUpToKobo } from './rounding';

export interface TermLoanTerms {
  readonly principalKobo: Kobo;
  /** Nominal annual rate as a percent, e.g. 18 or 17.35. */
  readonly annualRatePercent: number;
  readonly termMonths: number;
}

export interface ScheduleInstalment {
  readonly instalmentNumber: number;
  readonly paymentKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly principalKobo: Kobo;
  readonly closingBalanceKobo: Kobo;
}

const MONTHS_PER_YEAR = 12;

function monthlyRate(annualRatePercent: number): MoneyDecimal {
  return new MoneyDecimal(annualRatePercent).div(100).div(MONTHS_PER_YEAR);
}

/** instalment = P × i / (1 − (1 + i)^−n), rounded half-up once. */
export function calculateMonthlyInstalmentKobo(terms: TermLoanTerms): Kobo {
  const principal = new MoneyDecimal(terms.principalKobo);
  const rate = monthlyRate(terms.annualRatePercent);

  if (rate.isZero()) {
    return roundHalfUpToKobo(principal.div(terms.termMonths));
  }
  const discountFactor = new MoneyDecimal(1).minus(rate.plus(1).pow(-terms.termMonths));
  return roundHalfUpToKobo(principal.times(rate).div(discountFactor));
}

/** Monthly reducing-balance (annuity) schedule. The final instalment clears the balance. */
export function buildAmortisationSchedule(terms: TermLoanTerms): readonly ScheduleInstalment[] {
  const rate = monthlyRate(terms.annualRatePercent);
  const regularInstalmentKobo = calculateMonthlyInstalmentKobo(terms);

  const schedule: ScheduleInstalment[] = [];
  let openingBalanceKobo: Kobo = terms.principalKobo;

  for (let instalmentNumber = 1; instalmentNumber <= terms.termMonths; instalmentNumber += 1) {
    const isFinalInstalment = instalmentNumber === terms.termMonths;
    const interestKobo = roundHalfUpToKobo(new MoneyDecimal(openingBalanceKobo).times(rate));
    const principalKobo = isFinalInstalment
      ? openingBalanceKobo
      : subtractKobo(regularInstalmentKobo, interestKobo);
    const paymentKobo = isFinalInstalment ? addKobo(principalKobo, interestKobo) : regularInstalmentKobo;
    const closingBalanceKobo = subtractKobo(openingBalanceKobo, principalKobo);

    schedule.push({ instalmentNumber, paymentKobo, interestKobo, principalKobo, closingBalanceKobo });
    openingBalanceKobo = closingBalanceKobo;
  }
  return schedule;
}

export function sumInterestKobo(schedule: readonly ScheduleInstalment[]): Kobo {
  return schedule.reduce<Kobo>((total, row) => addKobo(total, row.interestKobo), ZERO_KOBO);
}

export function sumPaymentsKobo(schedule: readonly ScheduleInstalment[]): Kobo {
  return asKobo(schedule.reduce((total, row) => total + row.paymentKobo, 0));
}
