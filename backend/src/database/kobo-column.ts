import { asKobo, Kobo } from '../common/money';

/**
 * Money columns are BigInt in Prisma (its Int is 32-bit — ₦21.47M — and the brief goes to ₦5bn).
 * The application works in Kobo (safe-integer numbers), so every money column crosses this boundary exactly here.
 */
export function toKoboColumn(amount: Kobo): bigint {
  return BigInt(amount);
}

/** Throws if the stored value is outside the safe-integer range rather than silently losing kobo. */
export function fromKoboColumn(value: bigint | number): Kobo {
  if (typeof value === 'bigint' && (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))) {
    throw new RangeError(`Stored amount ${value.toString()} kobo is outside the safe integer range`);
  }
  return asKobo(Number(value));
}

/** For aggregate sums, which are null when no rows matched. */
export function fromKoboSum(value: bigint | number | null | undefined): Kobo {
  return fromKoboColumn(value ?? 0);
}
