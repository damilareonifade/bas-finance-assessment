import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { asKobo } from '@/lib/money';
import { CollectionsTable } from '../components/CollectionsTable';
import type { CollectionRow } from '../schemas/collections';

function row(overrides: Partial<CollectionRow>): CollectionRow {
  return {
    customerId: 'CUS-1',
    fullName: 'Late Payer',
    email: null,
    phone: '+2348012345678',
    assignedOfficer: null,
    createdAt: '2026-01-01T00:00:00Z',
    loanCount: 1,
    invoiceCount: 0,
    outstandingPrincipalKobo: asKobo(120_000_000),
    overdueKobo: asKobo(63_189_078),
    overdueInvoiceCount: 0,
    needsFollowUp: true,
    overdueInstalments: 3,
    oldestOverdueDays: 75,
    nextDueDate: null,
    ...overrides,
  };
}

describe('CollectionsTable', () => {
  it('flags who to chase, with the amount, how many instalments and for how long', () => {
    render(
      <MemoryRouter>
        <CollectionsTable showOfficer={false} rows={[row({}), row({ customerId: 'CUS-2', fullName: 'Current Payer', needsFollowUp: false, overdueKobo: asKobo(0), overdueInstalments: 0, oldestOverdueDays: 0, nextDueDate: '2026-02-10' })]} />
      </MemoryRouter>,
    );
    const [, lateRow, currentRow] = screen.getAllByRole('row');
    expect(within(lateRow as HTMLElement).getByText('Chase now')).toBeInTheDocument();
    expect(within(lateRow as HTMLElement).getByText('₦631,890.78')).toBeInTheDocument();
    expect(within(lateRow as HTMLElement).getByText('75 days')).toBeInTheDocument();
    expect(within(currentRow as HTMLElement).getByText('Up to date')).toBeInTheDocument();
    expect(within(currentRow as HTMLElement).getByText('2026-02-10')).toBeInTheDocument();
  });

  it('shows an empty state when nobody is assigned', () => {
    render(<MemoryRouter><CollectionsTable showOfficer={false} rows={[]} /></MemoryRouter>);
    expect(screen.getByText('No customers are assigned yet.')).toBeInTheDocument();
  });
});
