import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import LedgerPage from '../pages/LedgerPage';

afterEach(() => vi.restoreAllMocks());

const chidi = { customerId: 'CUS-000001', fullName: 'Chidi Okafor', email: 'chidi@example.com', phone: null };
const termProduct = { productId: 'PRD-000001', name: 'SME Growth' };

const line = (entryId: string, event: string, account: string, debitKobo: number, creditKobo: number, postedOn: string) => ({
  entryId, postedOn, event, reversesEntryId: null, account, debitKobo, creditKobo,
  customer: { customerId: chidi.customerId, fullName: chidi.fullName }, facility: { kind: 'LOAN', id: 'LN-000001' }, product: termProduct,
});

// Golden loan: disbursement, then the first instalment.
const chidiLines = [
  line('JE-000001', 'Disbursement', 'LOANS_RECEIVABLE', 120_000_000, 0, '2026-01-15'),
  line('JE-000001', 'Disbursement', 'CASH', 0, 120_000_000, '2026-01-15'),
  line('JE-000002', 'Repayment', 'CASH', 21_063_026, 0, '2026-02-15'),
  line('JE-000002', 'Repayment', 'LOANS_RECEIVABLE', 0, 19_263_026, '2026-02-15'),
  line('JE-000002', 'Repayment', 'INTEREST_INCOME', 0, 1_800_000, '2026-02-15'),
];

function ledgerBody(customer: boolean) {
  return {
    customer: customer ? { ...chidi, assignedOfficer: { userId: 'USR-000002', fullName: 'Ada Okoye' } } : null,
    product: null,
    period: { from: null, to: null },
    totals: { debitKobo: 141_063_026, creditKobo: 141_063_026, entryCount: 2, lineCount: 5, isBalanced: true },
    accounts: [
      { account: 'CASH', type: 'ASSET', debitKobo: 21_063_026, creditKobo: 120_000_000, balanceKobo: -98_936_974 },
      { account: 'LOANS_RECEIVABLE', type: 'ASSET', debitKobo: 120_000_000, creditKobo: 19_263_026, balanceKobo: 100_736_974 },
      { account: 'INTEREST_INCOME', type: 'INCOME', debitKobo: 0, creditKobo: 1_800_000, balanceKobo: 1_800_000 },
    ],
    products: [{ product: termProduct, debitKobo: 141_063_026, creditKobo: 141_063_026, entryCount: 2 }],
    position: customer ? { owedByCustomerKobo: 100_736_974, owedToCustomerKobo: 0, incomeEarnedKobo: 1_800_000, netCashKobo: -98_936_974 } : null,
    lines: chidiLines,
    truncated: false,
  };
}

function mockApi() {
  const ledgerRequests: URLSearchParams[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/loan-products') {
      return jsonResponse([{ product: { ...termProduct, type: 'TERM_LOAN', description: null, minPrincipalKobo: 100_000, maxPrincipalKobo: 500_000_000, minAnnualRatePercent: 10, maxAnnualRatePercent: 30, minTermMonths: 1, maxTermMonths: 60, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }, stats: { customerCount: 1, facilityCount: 1, outstandingKobo: 100_736_974 } }]);
    }
    if (url.pathname === '/ledger/search') return jsonResponse(url.searchParams.get('q')?.toLowerCase().includes('chi') ? [{ ...chidi, matchedOn: null }] : []);
    if (url.pathname === '/ledger') {
      ledgerRequests.push(url.searchParams);
      return jsonResponse(ledgerBody(url.searchParams.has('customerId')));
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return { ledgerRequests };
}

function renderPage(path = '/ledger') {
  renderWithProviders(
    <Routes>
      <Route path="/ledger" element={<LedgerPage />} />
    </Routes>,
    path,
  );
}

describe('LedgerPage', () => {
  it('starts on the whole book, then finds a customer by search and shows only their debits and credits', async () => {
    const { ledgerRequests } = mockApi();
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('whole book')).toBeInTheDocument();
    expect(ledgerRequests[0]?.has('customerId')).toBe(false);

    await user.type(screen.getByRole('combobox', { name: 'Customer' }), 'chi');
    await user.click(await screen.findByRole('option', { name: /Chidi Okafor/ }));

    expect(await screen.findByRole('heading', { name: 'Chidi Okafor' })).toBeInTheDocument();
    expect(ledgerRequests.at(-1)?.get('customerId')).toBe('CUS-000001');
    expect(screen.getByText('Owed by the customer').parentElement).toHaveTextContent('₦1,007,369.74');
    expect(screen.getByText('Income earned').parentElement).toHaveTextContent('₦18,000.00');
    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });

  it('lists every line newest first, and the account chips narrow the lines and their totals', async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage('/ledger?customerId=CUS-000001');
    const linesTable = await screen.findByRole('table', { name: 'Ledger lines' });
    expect(within(linesTable).getAllByRole('row')).toHaveLength(1 + 5 + 1); // header, lines, total
    expect(within(linesTable).getAllByRole('row')[1]).toHaveTextContent('2026-02-15'); // newest first

    await user.click(screen.getByRole('button', { name: 'Cash' }));
    expect(within(linesTable).getAllByRole('row')).toHaveLength(1 + 2 + 1);
    expect(within(linesTable).getByText('Total (2 lines)').closest('tr')).toHaveTextContent('₦210,630.26₦1,200,000.00');
  });

  it('narrows by loan product through the URL, which the server filters on', async () => {
    const { ledgerRequests } = mockApi();
    const user = userEvent.setup();
    renderPage('/ledger?customerId=CUS-000001');
    await screen.findByRole('heading', { name: 'Chidi Okafor' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'SME Growth' })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Loan product'), 'PRD-000001');
    await waitFor(() => expect(ledgerRequests.at(-1)?.get('loanProductId')).toBe('PRD-000001'));
    expect(ledgerRequests.at(-1)?.get('customerId')).toBe('CUS-000001');
  });
});
