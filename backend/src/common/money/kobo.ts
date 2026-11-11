declare const koboBrand: unique symbol;

/** An integer number of kobo (₦1 = 100 kobo). The only representation of money in this codebase. */
export type Kobo = number & { readonly [koboBrand]: true };

export const ZERO_KOBO = 0 as Kobo;

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
  return asKobo(amounts.reduce<number>((total, amount) => total + amount, 0));
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
