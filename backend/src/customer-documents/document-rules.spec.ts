import { AppError } from '../common/errors/app-errors';
import { assertSubmissionComplete, maskIdentifier } from './document-rules';

/** The field-level message the UI would show, or null when the submission is complete. */
function fieldProblem(check: () => void): string | null {
  try {
    check();
    return null;
  } catch (error) {
    if (error instanceof AppError && error.fieldErrors?.[0]) return `${error.fieldErrors[0].field}: ${error.fieldErrors[0].message}`;
    throw error;
  }
}

describe('maskIdentifier', () => {
  it.each([
    ['22212345678', '222••••••78'],
    ['A01234567', 'A01••••67'],
    ['12345', '•••••'],
    [null, null],
  ])('%s → %s', (input, expected) => expect(maskIdentifier(input)).toBe(expected));
});

describe('assertSubmissionComplete', () => {
  it('needs an 11-digit number for BVN and NIN', () => {
    expect(fieldProblem(() => assertSubmissionComplete('BVN', undefined, true))).toBe('identifier: Enter the BVN');
    expect(fieldProblem(() => assertSubmissionComplete('NIN', '1234567890', false))).toContain('11 digits');
    expect(fieldProblem(() => assertSubmissionComplete('NIN', '1234567890a', false))).toContain('11 digits');
    expect(fieldProblem(() => assertSubmissionComplete('BVN', '22212345678', false))).toBeNull();
  });

  it('needs a file for statements and bills', () => {
    expect(fieldProblem(() => assertSubmissionComplete('BANK_STATEMENT', 'ref-1', false))).toBe('file: Attach the bank statement');
    expect(fieldProblem(() => assertSubmissionComplete('UTILITY_BILL', undefined, true))).toBeNull();
  });

  it('needs a number or a file for everything else', () => {
    expect(fieldProblem(() => assertSubmissionComplete('PASSPORT', undefined, false))).toContain('number or attach a file');
    expect(fieldProblem(() => assertSubmissionComplete('PASSPORT', 'A01234567', false))).toBeNull();
    expect(fieldProblem(() => assertSubmissionComplete('OTHER', undefined, true))).toBeNull();
  });
});
