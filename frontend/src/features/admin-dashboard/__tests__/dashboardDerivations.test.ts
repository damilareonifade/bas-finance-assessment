import { describe, expect, it } from 'vitest';
import { asKobo } from '@/lib/money';
import { loanHealth, portfolioByProduct, recentActivity } from '../dashboardDerivations';

const paid = { dueDate: '2026-01-01', status: 'PAID' as const };
const unpaidPast = { dueDate: '2026-01-01', status: 'UNPAID' as const };
const partPast = { dueDate: '2026-01-01', status: 'PARTIALLY_PAID' as const };
const unpaidFuture = { dueDate: '2026-03-01', status: 'UNPAID' as const };

describe('loanHealth', () => {
  const today = '2026-02-01';
  it('is repaid when nothing is outstanding', () => {
    expect(loanHealth({ outstandingPrincipalKobo: asKobo(0), schedule: [paid] as never }, today)).toBe('repaid');
  });
  it('is overdue when an instalment due before today is not fully paid', () => {
    expect(loanHealth({ outstandingPrincipalKobo: asKobo(10), schedule: [unpaidPast, unpaidFuture] as never }, today)).toBe('overdue');
    expect(loanHealth({ outstandingPrincipalKobo: asKobo(10), schedule: [partPast] as never }, today)).toBe('overdue');
  });
  it('is current when everything due so far is paid', () => {
    expect(loanHealth({ outstandingPrincipalKobo: asKobo(10), schedule: [paid, unpaidFuture] as never }, today)).toBe('current');
  });
  it('treats an instalment due today as not yet overdue', () => {
    expect(loanHealth({ outstandingPrincipalKobo: asKobo(10), schedule: [{ dueDate: today, status: 'UNPAID' }] as never }, today)).toBe('current');
  });
});

describe('recentActivity', () => {
  const nameOf = (id: string | null) => (id === 'CUS-1' ? 'Chidi Okafor' : null);
  const items = recentActivity(
    [
      { loanId: 'LN-000001', customerId: 'CUS-1', principalKobo: asKobo(120_000_000), disbursedOn: '2026-01-10' },
      { loanId: 'LN-000002', customerId: null, principalKobo: asKobo(5_000_000), disbursedOn: '2026-01-12' },
    ],
    [{ invoiceId: 'INV-000001', customerId: 'CUS-1', advanceKobo: asKobo(80_000_000), issueDate: '2026-01-11', status: 'SETTLED' }],
    nameOf,
  );

  it('lists newest first across loans and invoices, linking each to its record', () => {
    expect(items.map((item) => item.id)).toEqual(['LN-000002', 'INV-000001', 'LN-000001']);
    expect(items[2]).toMatchObject({ title: 'Loan LN-000001 disbursed', detail: 'Chidi Okafor, ₦1,200,000.00', to: '/loans/LN-000001' });
    expect(items[1]).toMatchObject({ kind: 'invoice-settled', title: 'Invoice INV-000001 settled', to: '/invoices/INV-000001' });
    expect(items[0]?.detail).toBe('No customer, ₦50,000.00');
  });

  it('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ loanId: `LN-${index}`, customerId: null, principalKobo: asKobo(1), disbursedOn: '2026-01-01' }));
    expect(recentActivity(many, [], nameOf, 6)).toHaveLength(6);
  });
});

describe('portfolioByProduct', () => {
  const productName = (id: string | null) => (id === 'PRD-1' ? 'SME Term Loan' : id === 'PRD-2' ? 'Invoice Advance' : 'No product');

  it('adds outstanding loan principal and open invoice advances per product, largest first', () => {
    const slices = portfolioByProduct(
      [
        { loanProductId: 'PRD-1', outstandingPrincipalKobo: asKobo(100) },
        { loanProductId: 'PRD-1', outstandingPrincipalKobo: asKobo(50) },
        { loanProductId: null, outstandingPrincipalKobo: asKobo(30) },
        { loanProductId: 'PRD-1', outstandingPrincipalKobo: asKobo(0) },
      ],
      [
        { loanProductId: 'PRD-2', advanceKobo: asKobo(400), status: 'ADVANCED' },
        { loanProductId: 'PRD-2', advanceKobo: asKobo(999), status: 'SETTLED' },
      ],
      productName,
    );
    expect(slices).toEqual([
      { label: 'Invoice Advance', valueKobo: 400 },
      { label: 'SME Term Loan', valueKobo: 150 },
      { label: 'No product', valueKobo: 30 },
    ]);
  });

  it('is empty when nothing is outstanding', () => {
    expect(portfolioByProduct([{ loanProductId: 'PRD-1', outstandingPrincipalKobo: asKobo(0) }], [], productName)).toEqual([]);
  });
});
