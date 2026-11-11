import { asKobo, type Kobo } from './kobo';

const NAIRA_INPUT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses what a user typed ("1,200,000", "₦1,200,000.5") into kobo using string handling only.
 * Returns null when the text is not a valid naira amount (more than 2 decimals, letters, negatives…).
 */
export function parseNairaInputToKobo(rawInput: string): Kobo | null {
  const cleaned = rawInput.replace(/[₦,\s]/g, '');
  const match = NAIRA_INPUT_PATTERN.exec(cleaned);
  if (!match) return null;

  const [, wholeNairaDigits = '', fractionDigits = ''] = match;
  const koboDigits = `${wholeNairaDigits}${fractionDigits.padEnd(2, '0')}`;
  const kobo = Number(koboDigits);
  return Number.isSafeInteger(kobo) ? asKobo(kobo) : null;
}
