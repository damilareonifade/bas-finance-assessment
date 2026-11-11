import { addMonths, CalendarDate } from '../../common/dates/calendar-date';
import { addKobo, Kobo, subtractKobo, ZERO_KOBO } from '../../common/money';
import { MoneyDecimal, roundHalfUpToKobo } from '../../common/money/rounding';

export interface TermLoanTerms {
  readonly principalKobo: Kobo;
  /** Nominal annual rate as a percent, e.g. 18 or 17.35. */
  readonly annualRatePercent: number;
  readonly termMonths: number;
}

export interface ScheduledInstalment {
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
export function calculateInstalmentKobo(terms: TermLoanTerms): Kobo {
  const principal = new MoneyDecimal(terms.principalKobo);
  const rate = monthlyRate(terms.annualRatePercent);
  if (rate.isZero()) return roundHalfUpToKobo(principal.div(terms.termMonths));
  const discountFactor = new MoneyDecimal(1).minus(rate.plus(1).pow(-terms.termMonths));
  return roundHalfUpToKobo(principal.times(rate).div(discountFactor));
}

/** Monthly reducing-balance schedule. The final instalment clears the balance. */
export function buildSchedule(terms: TermLoanTerms): readonly ScheduledInstalment[] {
  const rate = monthlyRate(terms.annualRatePercent);
  const regularInstalmentKobo = calculateInstalmentKobo(terms);
  const schedule: ScheduledInstalment[] = [];
  let openingBalanceKobo: Kobo = terms.principalKobo;

  for (let instalmentNumber = 1; instalmentNumber <= terms.termMonths; instalmentNumber += 1) {
    const isFinal = instalmentNumber === terms.termMonths;
    const interestKobo = roundHalfUpToKobo(new MoneyDecimal(openingBalanceKobo).times(rate));
    const principalKobo = isFinal ? openingBalanceKobo : subtractKobo(regularInstalmentKobo, interestKobo);
    const paymentKobo = isFinal ? addKobo(principalKobo, interestKobo) : regularInstalmentKobo;
    const closingBalanceKobo = subtractKobo(openingBalanceKobo, principalKobo);
    schedule.push({ instalmentNumber, paymentKobo, interestKobo, principalKobo, closingBalanceKobo });
    openingBalanceKobo = closingBalanceKobo;
  }
  return schedule;
}

export function sumInterestKobo(schedule: readonly ScheduledInstalment[]): Kobo {
  return schedule.reduce<Kobo>((total, row) => addKobo(total, row.interestKobo), ZERO_KOBO);
}

/** Instalment k falls due k months after disbursement (clamped to month end). */
export function dueDateForInstalment(disbursedOn: CalendarDate, instalmentNumber: number): CalendarDate {
  return addMonths(disbursedOn, instalmentNumber);
}
