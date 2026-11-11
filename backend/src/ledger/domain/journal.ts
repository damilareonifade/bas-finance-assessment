import { InvariantViolationError } from '../../common/errors/app-errors';
import { addKobo, Kobo, ZERO_KOBO } from '../../common/money';
import { AccountCode } from './account';

export interface JournalLine {
  readonly account: AccountCode;
  readonly debitKobo: Kobo;
  readonly creditKobo: Kobo;
}

/** A requested line: one side carries the amount. Zero-amount lines are dropped before posting. */
export function debit(account: AccountCode, amountKobo: Kobo): JournalLine {
  return { account, debitKobo: amountKobo, creditKobo: ZERO_KOBO };
}

export function credit(account: AccountCode, amountKobo: Kobo): JournalLine {
  return { account, debitKobo: ZERO_KOBO, creditKobo: amountKobo };
}

export function totalDebitsKobo(lines: readonly JournalLine[]): Kobo {
  return addKobo(...lines.map((line) => line.debitKobo));
}

export function totalCreditsKobo(lines: readonly JournalLine[]): Kobo {
  return addKobo(...lines.map((line) => line.creditKobo));
}

/**
 * Validates and normalises lines for posting:
 *  - lines with a zero amount are NOT posted
 *  - every remaining line has exactly one positive side
 *  - at least two lines
 *  - total debits = total credits
 */
export function prepareLinesForPosting(requestedLines: readonly JournalLine[]): readonly JournalLine[] {
  const postedLines = requestedLines.filter((line) => line.debitKobo !== 0 || line.creditKobo !== 0);

  for (const line of postedLines) {
    const hasBothSides = line.debitKobo !== 0 && line.creditKobo !== 0;
    if (hasBothSides || line.debitKobo < 0 || line.creditKobo < 0) {
      throw new InvariantViolationError(`Journal line for ${line.account} must have exactly one positive side`);
    }
  }
  if (postedLines.length < 2) throw new InvariantViolationError('A journal entry needs at least two non-zero lines');

  const debits = totalDebitsKobo(postedLines);
  const credits = totalCreditsKobo(postedLines);
  if (debits !== credits) throw new InvariantViolationError(`Journal entry is not balanced: debits ${debits} ≠ credits ${credits}`);
  return postedLines;
}

/** Mirror image of a journal, used to build a reversing entry. */
export function reverseLines(lines: readonly JournalLine[]): readonly JournalLine[] {
  return lines.map((line) => ({ account: line.account, debitKobo: line.creditKobo, creditKobo: line.debitKobo }));
}
