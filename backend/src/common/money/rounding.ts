import Decimal from 'decimal.js';
import { asKobo, Kobo } from './kobo';

/** Decimal constructor with generous precision and half-up rounding. Used for every intermediate value. */
export const MoneyDecimal = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
export type MoneyDecimal = InstanceType<typeof MoneyDecimal>;

/** The ONLY rounding function for money: half-up to the nearest kobo. Never call it on intermediates. */
export function roundHalfUpToKobo(value: MoneyDecimal): Kobo {
  return asKobo(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber());
}
