import { describe, expect, it } from 'vitest';
import { asKobo, formatKobo, isKobo, parseNairaInputToKobo } from '..';

describe('parseNairaInputToKobo', () => {
  it.each([
    ['1,200,000', 120_000_000],
    ['₦1,200,000.50', 120_000_050],
    ['0.5', 50],
    ['1000', 100_000],
    ['0.07', 7],
    ['5,000,000,000', 500_000_000_000],
  ])('parses %s', (input, expectedKobo) => {
    expect(parseNairaInputToKobo(input)).toBe(expectedKobo);
  });

  it.each(['', 'abc', '-5', '1.234', '1..2', '12e3', '₦'])('rejects %j', (input) => {
    expect(parseNairaInputToKobo(input)).toBeNull();
  });

  it('rejects values beyond safe integer range', () => {
    expect(parseNairaInputToKobo('99999999999999999999')).toBeNull();
  });
});

describe('formatKobo', () => {
  it.each([
    [120_000_000, '₦1,200,000.00'],
    [21_063_026, '₦210,630.26'],
    [5, '₦0.05'],
    [0, '₦0.00'],
    [-94_247, '-₦942.47'],
    [500_000_000_000, '₦5,000,000,000.00'],
  ])('formats %i as %s', (kobo, expected) => {
    expect(formatKobo(asKobo(kobo))).toBe(expected);
  });

  it('round-trips with parse', () => {
    expect(parseNairaInputToKobo(formatKobo(asKobo(123_456_789)))).toBe(123_456_789);
  });
});

describe('asKobo / isKobo', () => {
  it('rejects floats and unsafe integers', () => {
    expect(() => asKobo(10.5)).toThrow(RangeError);
    expect(() => asKobo(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(isKobo(10.5)).toBe(false);
    expect(isKobo('10')).toBe(false);
    expect(isKobo(10)).toBe(true);
  });
});
