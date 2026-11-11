import { z } from 'zod';

declare const koboBrand: unique symbol;

/** An integer number of kobo (₦1 = 100 kobo). The only way money is represented in this app. */
export type Kobo = number & { readonly [koboBrand]: true };

export const ZERO_KOBO = 0 as Kobo;

export const KOBO_PER_NAIRA = 100;

/** Business limits from the brief — mirrored by the server. */
export const MIN_PRINCIPAL_KOBO = 100_000 as Kobo; // ₦1,000
export const MAX_PRINCIPAL_KOBO = 500_000_000_000 as Kobo; // ₦5,000,000,000
export const MIN_ANNUAL_RATE_PERCENT = 0.5;
export const MAX_ANNUAL_RATE_PERCENT = 60;
export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 60;

export function isKobo(value: unknown): value is Kobo {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Single sanctioned entry point for turning a number into Kobo. Throws on floats / unsafe integers. */
export function asKobo(value: number): Kobo {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be a safe integer number of kobo, received ${String(value)}`);
  }
  return value as Kobo;
}

export function addKobo(...amounts: readonly Kobo[]): Kobo {
  return asKobo(amounts.reduce<number>((runningTotal, amount) => runningTotal + amount, 0));
}

export function subtractKobo(minuend: Kobo, subtrahend: Kobo): Kobo {
  return asKobo(minuend - subtrahend);
}

export function minKobo(first: Kobo, second: Kobo): Kobo {
  return first <= second ? first : second;
}

export function maxKobo(first: Kobo, second: Kobo): Kobo {
  return first >= second ? first : second;
}

/** zod schema for a kobo value on the wire: a JSON integer. Rejects floats, strings and unsafe integers. */
export const koboSchema = z
  .number()
  .int()
  .safe()
  .transform((value) => asKobo(value));
