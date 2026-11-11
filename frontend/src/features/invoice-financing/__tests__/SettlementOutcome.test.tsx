import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { asKobo } from '@/lib/money';
import { SettlementOutcome } from '../components/SettlementOutcome';
import type { InvoiceSettlement } from '../schemas/invoice';

const shortfallSettlement: InvoiceSettlement = {
  daysOverdue: 96,
  discountFeeKobo: asKobo(4_734_247),
  latePenaltyKobo: asKobo(15_360_000),
  totalChargesKobo: asKobo(20_094_247),
  clientReceivesKobo: asKobo(0),
  clientOwesKobo: asKobo(94_247),
  journalEntry: {
    entryId: 'JE-1',
    postedOn: '2026-01-01',
    event: 'Invoice settlement',
    lines: [
      { account: 'CASH', debitKobo: asKobo(100_000_000), creditKobo: asKobo(0) },
      { account: 'CLIENT_RECEIVABLE', debitKobo: asKobo(94_247), creditKobo: asKobo(0) },
      { account: 'INVOICE_RECEIVABLES', debitKobo: asKobo(0), creditKobo: asKobo(80_000_000) },
      { account: 'FEE_INCOME', debitKobo: asKobo(0), creditKobo: asKobo(4_734_247) },
      { account: 'PENALTY_INCOME', debitKobo: asKobo(0), creditKobo: asKobo(15_360_000) },
    ],
  },
};

describe('SettlementOutcome', () => {
  it('shows the shortfall clearly and never a negative payable', () => {
    render(<SettlementOutcome settlement={shortfallSettlement} isPosted={false} isConfirming={false} onConfirm={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('the client owes the lender');
    expect(screen.getByRole('alert')).toHaveTextContent('₦942.47');
    expect(document.body.textContent).not.toMatch(/-₦/);
  });

  it('shows no shortfall alert when the reserve covers the charges', () => {
    const covered: InvoiceSettlement = { ...shortfallSettlement, daysOverdue: 0, clientOwesKobo: asKobo(0), clientReceivesKobo: asKobo(15_265_753) };
    render(<SettlementOutcome settlement={covered} isPosted={false} isConfirming={false} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the confirm button once posted', () => {
    render(<SettlementOutcome settlement={shortfallSettlement} isPosted isConfirming={false} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /confirm settlement/i })).not.toBeInTheDocument();
  });
});
