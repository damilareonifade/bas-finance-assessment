import { describe, expect, it } from 'vitest';
import { loanProductFormSchema } from '../schemas/loanProduct';

const blank = { name: 'SME Loan', type: 'TERM_LOAN', description: '', minPrincipalInput: '', maxPrincipalInput: '', minRateInput: '', maxRateInput: '', minTermInput: '', maxTermInput: '' } as const;

describe('loanProductFormSchema', () => {
  it('turns naira text into kobo and leaves blank limits undefined (server defaults)', () => {
    const parsed = loanProductFormSchema.parse({ ...blank, minPrincipalInput: '100,000', maxPrincipalInput: '2,000,000.50', minRateInput: '12.5', maxRateInput: '24', minTermInput: '3', maxTermInput: '' });
    expect(parsed).toMatchObject({ name: 'SME Loan', minPrincipalKobo: 10_000_000, maxPrincipalKobo: 200_000_050, minAnnualRatePercent: 12.5, maxAnnualRatePercent: 24, minTermMonths: 3 });
    expect(parsed.maxTermMonths).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it('does not send rate or term limits for invoice financing', () => {
    const parsed = loanProductFormSchema.parse({ ...blank, type: 'INVOICE_FINANCING', minRateInput: '12', minTermInput: '3' });
    expect(parsed).not.toHaveProperty('minAnnualRatePercent');
    expect(parsed).not.toHaveProperty('minTermMonths');
  });

  it('reports bad input against the right fields', () => {
    const result = loanProductFormSchema.safeParse({ ...blank, name: 'x', minPrincipalInput: '12.345', minRateInput: 'abc', minTermInput: '2.5' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => String(issue.path[0])).sort()).toEqual(['minPrincipalInput', 'minRateInput', 'minTermInput', 'name']);
  });
});
