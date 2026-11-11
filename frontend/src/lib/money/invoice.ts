import { addKobo, maxKobo, subtractKobo, ZERO_KOBO, type Kobo } from './kobo';
import { MoneyDecimal, roundHalfUpToKobo } from './rounding';

export const INVOICE_ADVANCE_RATE = '0.8';
export const INVOICE_ANNUAL_DISCOUNT_RATE = '0.36';
export const INVOICE_DAILY_PENALTY_RATE = '0.002';
export const DAY_COUNT_BASIS = 365;

export interface InvoiceAdvance {
  readonly advanceKobo: Kobo;
  readonly reserveKobo: Kobo;
}

export interface InvoiceSettlementInput {
  readonly faceValueKobo: Kobo;
  /** Days between issue/advance date and due date. */
  readonly tenorDays: number;
  /** Days after the due date that the debtor paid (0 when on time). */
  readonly daysOverdue: number;
}

export interface InvoiceSettlementOutcome extends InvoiceAdvance {
  readonly discountFeeKobo: Kobo;
  readonly latePenaltyKobo: Kobo;
  readonly totalChargesKobo: Kobo;
  readonly clientReceivesKobo: Kobo;
  /** Shortfall when charges exceed the reserve. Never negative. */
  readonly clientOwesKobo: Kobo;
}

export function calculateInvoiceAdvance(faceValueKobo: Kobo): InvoiceAdvance {
  const advanceKobo = roundHalfUpToKobo(new MoneyDecimal(faceValueKobo).times(INVOICE_ADVANCE_RATE));
  return { advanceKobo, reserveKobo: subtractKobo(faceValueKobo, advanceKobo) };
}

/** discount fee = advance × 36% × tenorDays / 365 (round half-up once). */
export function calculateDiscountFeeKobo(advanceKobo: Kobo, tenorDays: number): Kobo {
  return roundHalfUpToKobo(
    new MoneyDecimal(advanceKobo).times(INVOICE_ANNUAL_DISCOUNT_RATE).times(tenorDays).div(DAY_COUNT_BASIS),
  );
}

/** late penalty = advance × 0.2% × days overdue. Overdue starts the day after the due date. */
export function calculateLatePenaltyKobo(advanceKobo: Kobo, daysOverdue: number): Kobo {
  return roundHalfUpToKobo(new MoneyDecimal(advanceKobo).times(INVOICE_DAILY_PENALTY_RATE).times(daysOverdue));
}

/** Lender keeps fee + penalty from the reserve; any excess charge is a shortfall the client owes. */
export function calculateInvoiceSettlement(input: InvoiceSettlementInput): InvoiceSettlementOutcome {
  const { advanceKobo, reserveKobo } = calculateInvoiceAdvance(input.faceValueKobo);
  const discountFeeKobo = calculateDiscountFeeKobo(advanceKobo, input.tenorDays);
  const latePenaltyKobo = calculateLatePenaltyKobo(advanceKobo, Math.max(0, input.daysOverdue));
  const totalChargesKobo = addKobo(discountFeeKobo, latePenaltyKobo);

  const clientReceivesKobo = maxKobo(subtractKobo(reserveKobo, totalChargesKobo), ZERO_KOBO);
  const clientOwesKobo = maxKobo(subtractKobo(totalChargesKobo, reserveKobo), ZERO_KOBO);

  return { advanceKobo, reserveKobo, discountFeeKobo, latePenaltyKobo, totalChargesKobo, clientReceivesKobo, clientOwesKobo };
}
