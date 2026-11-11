import { addKobo, Kobo, maxKobo, subtractKobo, ZERO_KOBO } from '../../common/money';
import { MoneyDecimal, roundHalfUpToKobo } from '../../common/money/rounding';
import { credit, debit, JournalLine } from '../../ledger/domain/journal';

export const INVOICE_ADVANCE_RATE = '0.8';
export const INVOICE_ANNUAL_DISCOUNT_RATE = '0.36';
export const INVOICE_DAILY_PENALTY_RATE = '0.002';
export const DAY_COUNT_BASIS = 365;

export interface InvoiceAdvance {
  readonly advanceKobo: Kobo;
  readonly reserveKobo: Kobo;
}

export interface InvoiceSettlementOutcome extends InvoiceAdvance {
  readonly discountFeeKobo: Kobo;
  readonly latePenaltyKobo: Kobo;
  readonly totalChargesKobo: Kobo;
  readonly clientReceivesKobo: Kobo;
  /** Shortfall when charges exceed the reserve. Never negative. */
  readonly clientOwesKobo: Kobo;
}

export function calculateAdvance(faceValueKobo: Kobo): InvoiceAdvance {
  const advanceKobo = roundHalfUpToKobo(new MoneyDecimal(faceValueKobo).times(INVOICE_ADVANCE_RATE));
  return { advanceKobo, reserveKobo: subtractKobo(faceValueKobo, advanceKobo) };
}

/** discount fee = advance × 36% × tenorDays / 365 (round half-up once). */
export function calculateDiscountFeeKobo(advanceKobo: Kobo, tenorDays: number): Kobo {
  return roundHalfUpToKobo(new MoneyDecimal(advanceKobo).times(INVOICE_ANNUAL_DISCOUNT_RATE).times(tenorDays).div(DAY_COUNT_BASIS));
}

/** late penalty = advance × 0.2% × days overdue. Overdue starts the day after the due date. */
export function calculateLatePenaltyKobo(advanceKobo: Kobo, daysOverdue: number): Kobo {
  return roundHalfUpToKobo(new MoneyDecimal(advanceKobo).times(INVOICE_DAILY_PENALTY_RATE).times(Math.max(0, daysOverdue)));
}

export function calculateSettlement(input: { faceValueKobo: Kobo; tenorDays: number; daysOverdue: number }): InvoiceSettlementOutcome {
  const { advanceKobo, reserveKobo } = calculateAdvance(input.faceValueKobo);
  const discountFeeKobo = calculateDiscountFeeKobo(advanceKobo, input.tenorDays);
  const latePenaltyKobo = calculateLatePenaltyKobo(advanceKobo, input.daysOverdue);
  const totalChargesKobo = addKobo(discountFeeKobo, latePenaltyKobo);
  return {
    advanceKobo,
    reserveKobo,
    discountFeeKobo,
    latePenaltyKobo,
    totalChargesKobo,
    clientReceivesKobo: maxKobo(subtractKobo(reserveKobo, totalChargesKobo), ZERO_KOBO),
    clientOwesKobo: maxKobo(subtractKobo(totalChargesKobo, reserveKobo), ZERO_KOBO),
  };
}

/**
 * Dr Cash (face paid by the debtor); Cr Invoice Receivables, Fee Income, Penalty Income, Client Payable.
 * If the client owes a shortfall: Dr Client Receivable for it instead. Zero lines are dropped when posting.
 */
export function buildSettlementLines(faceValueKobo: Kobo, outcome: InvoiceSettlementOutcome): readonly JournalLine[] {
  return [
    debit('CASH', faceValueKobo),
    debit('CLIENT_RECEIVABLE', outcome.clientOwesKobo),
    credit('INVOICE_RECEIVABLES', outcome.advanceKobo),
    credit('FEE_INCOME', outcome.discountFeeKobo),
    credit('PENALTY_INCOME', outcome.latePenaltyKobo),
    credit('CLIENT_PAYABLE', outcome.clientReceivesKobo),
  ];
}
