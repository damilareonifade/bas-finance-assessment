import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalAccessPanel } from '@/features/customers/components/PortalAccessPanel';
import { jsonResponse, renderWithProviders } from '@/test/renderWithProviders';
import { PortalLayout } from '../components/PortalLayout';
import { RequirePortalAuth } from '../components/RequirePortalAuth';
import PortalApplyPage from '../pages/PortalApplyPage';
import PortalHomePage from '../pages/PortalHomePage';
import PortalInvoicePage from '../pages/PortalInvoicePage';
import { checkApplication, type PortalProduct } from '../schemas/portal';

afterEach(() => vi.restoreAllMocks());

const customer = { accountId: 'CAC-000001', customerId: 'CUS-000001', fullName: 'Chidi Okafor', email: 'chidi@example.com' };
const product: PortalProduct = {
  productId: 'PRD-000001', name: 'SME Growth', description: null, annualRatePercent: 18,
  minPrincipalKobo: 10_000_000 as PortalProduct['minPrincipalKobo'], maxPrincipalKobo: 500_000_000 as PortalProduct['maxPrincipalKobo'], minTermMonths: 3, maxTermMonths: 12,
};
const loan = {
  loanId: 'LN-000001', productName: 'SME Growth', principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6, instalmentKobo: 21_063_026,
  disbursedOn: '2026-01-15', outstandingPrincipalKobo: 100_736_974, overdueKobo: 0,
  nextPayment: { instalmentNumber: 2, dueDate: '2026-03-15', amountDueKobo: 21_063_026 }, status: 'ACTIVE',
};
const emptyInbox = { unreadCount: 0, items: [] };
// Golden invoice example scaled to ₦1,000,000: advance 80%, fee for 60 days at 36%.
const openInvoice = {
  invoiceId: 'INV-000001', productName: 'Invoice discounting', status: 'OPEN', faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02', tenorDays: 60,
  advanceKobo: 80_000_000, reserveKobo: 20_000_000, discountFeeKobo: 4_734_247, latePenaltyPerDayKobo: 160_000, daysOverdue: 0, latePenaltyKobo: 0,
  reserveReleasedKobo: 0, totalPaidToYouKobo: 80_000_000, youOweKobo: 0, settledOn: null, ifSettledToday: { reserveReleasedKobo: 15_265_753, youOweKobo: 0 },
};
const settledShortfallInvoice = {
  ...openInvoice, status: 'SETTLED', daysOverdue: 96, latePenaltyKobo: 15_360_000, reserveReleasedKobo: 0, totalPaidToYouKobo: 80_000_000, youOweKobo: 94_247,
  settledOn: '2026-06-06', ifSettledToday: null,
};

function homeHandlers() {
  return {
    'GET /portal/auth/me': () => jsonResponse({ customer }),
    'GET /portal/notifications': () => jsonResponse(emptyInbox),
    'GET /portal/overview': () =>
      jsonResponse({
        customer: { customerId: customer.customerId, fullName: customer.fullName, email: customer.email, phone: null },
        officer: { userId: 'USR-000002', fullName: 'Ada Okoye', email: 'ada@lender.test' },
        loans: [loan],
        invoices: [openInvoice],
        applications: [],
        documents: { toProvide: 0, awaitingReview: 0, needsAttention: 0, verified: 0 },
      }),
  };
}

function renderHome() {
  renderWithProviders(
    <Routes>
      <Route path="/portal" element={<RequirePortalAuth />}>
        <Route element={<PortalLayout />}>
          <Route index element={<PortalHomePage />} />
        </Route>
      </Route>
    </Routes>,
    '/portal',
  );
}

/** Routes requests by path; anything unknown fails the test loudly. */
function mockApi(handlers: Record<string, (init?: RequestInit) => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const handler = handlers[`${init?.method ?? 'GET'} ${path}`];
    if (!handler) throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${path}`);
    return handler(init);
  });
}

describe('checkApplication (mirrors the product limits the server enforces)', () => {
  it('needs a product, an amount inside its limits and a term inside its range', () => {
    expect(checkApplication(undefined, '500000', '6').errors).toEqual({ loanProductId: 'Choose a loan' });
    expect(checkApplication(product, 'abc', '6').errors.amount).toBe('Enter an amount in naira, e.g. 250000');
    expect(checkApplication(product, '50000', '6').errors.amount).toBe('Choose between ₦100,000.00 and ₦5,000,000.00');
    expect(checkApplication(product, '500000', '24').errors.termMonths).toBe('Choose 3 to 12 months');
    expect(checkApplication(product, '1,200,000', '6')).toEqual({ errors: {}, principalKobo: 120_000_000, termMonths: 6 });
  });
});

describe('portal session', () => {
  it('sends a signed-out customer to the portal sign-in, never the staff one', async () => {
    mockApi({ 'GET /portal/auth/me': () => jsonResponse({ statusCode: 401, code: 'UNAUTHENTICATED', message: 'Authentication required' }, 401) });
    renderWithProviders(
      <Routes>
        <Route path="/portal/login" element={<p>Portal sign-in page</p>} />
        <Route path="/login" element={<p>Staff sign-in page</p>} />
        <Route path="/portal" element={<RequirePortalAuth />}>
          <Route index element={<p>Portal home</p>} />
        </Route>
      </Routes>,
      '/portal',
    );
    expect(await screen.findByText('Portal sign-in page')).toBeInTheDocument();
    expect(screen.queryByText('Staff sign-in page')).not.toBeInTheDocument();
  });
});

describe('PortalHomePage', () => {
  it('shows each loan with what is left and the next payment, and points to documents that are needed', async () => {
    mockApi({
      'GET /portal/auth/me': () => jsonResponse({ customer }),
      'GET /portal/notifications': () => jsonResponse(emptyInbox),
      'GET /portal/overview': () =>
        jsonResponse({
          customer: { customerId: customer.customerId, fullName: customer.fullName, email: customer.email, phone: null },
          officer: { userId: 'USR-000002', fullName: 'Ada Okoye', email: 'ada@lender.test' },
          loans: [loan],
          invoices: [openInvoice],
          applications: [],
          documents: { toProvide: 1, awaitingReview: 0, needsAttention: 0, verified: 0 },
        }),
    });
    renderWithProviders(
      <Routes>
        <Route path="/portal" element={<RequirePortalAuth />}>
          <Route element={<PortalLayout />}>
            <Route index element={<PortalHomePage />} />
          </Route>
        </Route>
      </Routes>,
      '/portal',
    );
    expect(await screen.findByRole('heading', { name: 'Hello, Chidi' })).toBeInTheDocument();
    expect(screen.getAllByText('₦1,007,369.74').length).toBeGreaterThan(0);
    expect(screen.getByText('Due 15 Mar 2026 · instalment 2 of 6')).toBeInTheDocument();
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText(/We need 1 document from you/)).toBeInTheDocument();
    const loanCard = screen.getByRole('link', { name: /SME Growth\s*LN-000001/ });
    expect(loanCard).toHaveAttribute('href', '/portal/loans/LN-000001');
    expect(loanCard).toHaveTextContent('Monthly payment₦210,630.26');
  });

  it('uses the same navy sidebar as staff, with the customer’s own destinations', async () => {
    mockApi(homeHandlers());
    renderHome();
    const navigation = await screen.findByRole('navigation', { name: 'Portal' });
    const linkTargets = Array.from(navigation.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(linkTargets).toEqual(['/portal', '/portal/loans', '/portal/invoices', '/portal/applications', '/portal/apply', '/portal/documents']);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Chidi Okafor/ })).toBeInTheDocument(); // account menu, as in the staff topbar
  });

  it('shows who the loan officer is and how to reach them', async () => {
    mockApi(homeHandlers());
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Your loan officer' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'ada@lender.test' })[0]).toHaveAttribute('href', 'mailto:ada@lender.test');
    expect(screen.getAllByText('Ada Okoye').length).toBeGreaterThan(0);
  });

  it('shows financed invoices with what has been paid to the customer', async () => {
    mockApi(homeHandlers());
    renderHome();
    const invoiceCard = await screen.findByRole('link', { name: /Invoice discounting\s*INV-000001/ });
    expect(invoiceCard).toHaveAttribute('href', '/portal/invoices/INV-000001');
    expect(invoiceCard).toHaveTextContent('Total paid to you₦800,000.00');
    expect(invoiceCard).toHaveTextContent('Reserve we are holding₦200,000.00');
    expect(invoiceCard).toHaveTextContent('Awaiting payment');
  });
});

describe('PortalInvoicePage', () => {
  it('a settled invoice: the advance plus what was left of the reserve, and the shortfall in red when charges exceeded it', async () => {
    mockApi({
      'GET /portal/auth/me': () => jsonResponse({ customer }),
      'GET /portal/notifications': () => jsonResponse(emptyInbox),
      'GET /portal/invoices/INV-000001': () => jsonResponse(settledShortfallInvoice),
    });
    renderWithProviders(
      <Routes>
        <Route path="/portal" element={<RequirePortalAuth />}>
          <Route path="invoices/:invoiceId" element={<PortalInvoicePage />} />
        </Route>
      </Routes>,
      '/portal/invoices/INV-000001',
    );
    expect(await screen.findByText('Settled')).toBeInTheDocument();
    expect(screen.getByText('Total paid to you').parentElement).toHaveTextContent('₦800,000.00');
    expect(screen.getByRole('heading', { name: /What happened at settlement/ })).toBeInTheDocument();
    expect(screen.getByText('You owe us on this invoice')).toBeInTheDocument();
    expect(screen.getAllByText('₦942.47').length).toBeGreaterThan(0);
    // Never a negative payout: the reserve paid back is ₦0, and the shortfall is shown as owed instead.
    expect(screen.getByText('Paid to you').parentElement?.parentElement).toHaveTextContent('₦0.00');
  });
});

describe('PortalApplyPage', () => {
  it('shows the server’s monthly payment for the chosen terms and applies without sending a rate', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi({
      'GET /portal/products': () => jsonResponse([product]),
      'POST /portal/quote': () => jsonResponse({ instalmentKobo: 21_063_026, totalInterestKobo: 6_378_154, schedule: [{ instalmentNumber: 1, paymentKobo: 21_063_026, interestKobo: 1_800_000, principalKobo: 19_263_026, closingBalanceKobo: 100_736_974 }], annualRatePercent: 18 }),
      'POST /portal/applications': () =>
        jsonResponse({ applicationId: 'APP-000001', status: 'SUBMITTED', product: { productId: product.productId, name: product.name }, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6, purpose: 'Stock', submittedAt: '2026-11-11T09:00:00.000Z', decidedAt: null, rejectionReason: null, loanId: null }, 201),
    });
    renderWithProviders(<PortalApplyPage />);
    await user.click(await screen.findByRole('radio', { name: /SME Growth/ }));
    await user.type(screen.getByLabelText(/How much/), '1200000');
    await user.type(screen.getByLabelText(/For how many months/), '6');
    expect(await screen.findByText('₦210,630.26')).toBeInTheDocument();
    expect(screen.getByText('₦63,781.54')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/What is the loan for/), 'Stock');
    await user.click(screen.getByRole('button', { name: 'Send application' }));
    expect(await screen.findByText('Application sent')).toBeInTheDocument();
    const applyCall = fetchSpy.mock.calls.find(([input, init]) => String(input).endsWith('/portal/applications') && init?.method === 'POST');
    expect(JSON.parse(String(applyCall?.[1]?.body))).toEqual({ loanProductId: 'PRD-000001', principalKobo: 120_000_000, termMonths: 6, purpose: 'Stock' });
  });

  it('keeps out-of-range terms on the form instead of sending them', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi({ 'GET /portal/products': () => jsonResponse([product]) });
    renderWithProviders(<PortalApplyPage />);
    await user.click(await screen.findByRole('radio', { name: /SME Growth/ }));
    await user.type(screen.getByLabelText(/How much/), '1200000');
    await user.type(screen.getByLabelText(/For how many months/), '24');
    await user.click(screen.getByRole('button', { name: 'Send application' }));
    expect(await screen.findByText('Choose 3 to 12 months')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes('/portal/applications'))).toBe(false);
  });
});

describe('PortalAccessPanel (staff)', () => {
  it('invites the customer and shows the one-time link to share', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi({
      'GET /customers/CUS-000001/portal-access': () => jsonResponse({ status: 'NONE', email: null, invitationExpiresAt: null, lastLoginAt: null }),
      'POST /customers/CUS-000001/portal-access/invitation': () =>
        jsonResponse({ access: { status: 'INVITED', email: 'chidi@example.com', invitationExpiresAt: '2026-11-18T09:00:00.000Z', lastLoginAt: null }, inviteLink: 'http://localhost:5173/portal/accept-invite?token=abc' }, 201),
    });
    renderWithProviders(<PortalAccessPanel customerId="CUS-000001" customerEmail="chidi@example.com" isAdmin />);
    expect(await screen.findByText('Not invited')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Invite to portal' }));
    expect(await screen.findByText('http://localhost:5173/portal/accept-invite?token=abc')).toBeInTheDocument();
    expect(screen.getByText('Invited')).toBeInTheDocument();
    await waitFor(() => {
      const inviteCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/portal-access/invitation'));
      expect(JSON.parse(String(inviteCall?.[1]?.body))).toEqual({ email: 'chidi@example.com' });
    });
  });
});
