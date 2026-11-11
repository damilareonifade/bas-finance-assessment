import { describe, expect, it } from 'vitest';
import { asKobo, formatKoboCompact } from '..';

describe('formatKoboCompact', () => {
  it.each([
    [0, '₦0'],
    [99, '₦0'],
    [99_900, '₦999'],
    [100_000, '₦1K'],
    [250_000, '₦2.5K'],
    [100_000_000, '₦1M'],
    [12_000_000_000, '₦120M'],
    [349_999_999, '₦3.4M'],
    [500_000_000_000, '₦5B'],
    [-12_000_000_000, '-₦120M'],
  ])('formats %i kobo as %s', (kobo, expected) => {
    expect(formatKoboCompact(asKobo(kobo))).toBe(expected);
  });
});
