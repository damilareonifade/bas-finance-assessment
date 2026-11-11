import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/AppProviders';
import { readPostedEntry } from '@/features/ledger';
import { asKobo, buildAmortisationSchedule, calculateMonthlyInstalmentKobo, sumInterestKobo } from '@/lib/money';
import { jsonResponse } from '@/test/renderWithProviders';
import LoanCreatePage from '../pages/LoanCreatePage';

const terms = { principalKobo: asKobo(120_000_000), annualRatePercent: 18, termMonths: 6 };
const schedule = buildAmortisationSchedule(terms);
const quoteBody = { instalmentKobo: calculateMonthlyInstalmentKobo(terms), totalInterestKobo: sumInterestKobo(schedule), schedule };
const customers = [
  { customerId: 'CUS-1', fullName: 'Chidi Okafor', email: null, phone: null, assignedOfficer: null, createdAt: '2026-01-01', loanCount: 0, invoiceCount: 0, outstandingPrincipalKobo: 0, overdueKobo: 0, overdueInvoiceCount: 0 },
];
const disbursedBody = {
  loan: {
    loanId: 'LN-1',
    approvedBy: { userId: 'USR-1', fullName: 'Administrator' },
    approvedAt: '2026-01-01T09:00:00.000Z',
    assignedOfficer: null,
    applicationId: null,
    customerId: 'CUS-1',
    loanProductId: null,
    outstandingPrincipalKobo: 120_000_000,
    ...terms,
    disbursedOn: '2026-01-01',
    unappliedCreditKobo: 0,
    schedule: schedule.map((row) => ({ ...row, dueDate: '2026-02-01', status: 'UNPAID', principalPaidKobo: 0 })),
  },
  journalEntry: {
    entryId: 'JE-1',
    postedOn: '2026-01-01',
    event: 'Disbursement',
    lines: [
      { account: 'LOANS_RECEIVABLE', debitKobo: 120_000_000, creditKobo: 0 },
      { account: 'CASH', debitKobo: 0, creditKobo: 120_000_000 },
    ],
  },
};

afterEach(() => vi.restoreAllMocks());

/** Stands in for the loan page so the test can see where it landed and what was handed over. */
function LoanPageProbe() {
  const { loanId } = useParams();
  const entry = readPostedEntry(useLocation().state);
  return <p>Landed on {loanId} with {entry?.entryId ?? 'no entry'}</p>;
}

function renderCreatePage(path = '/loans/create') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/loans/create" element={<LoanCreatePage />} />
          <Route path="/loans/:loanId" element={<LoanPageProbe />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

async function fillAndQuote(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/principal/i), '1,200,000');
  await user.type(screen.getByLabelText(/annual interest rate/i), '18');
  await user.type(screen.getByLabelText(/term \(months\)/i), '6');
  await user.click(screen.getByRole('button', { name: /get quote/i }));
}

function mockApi(onDisburse?: (init: RequestInit | undefined) => void) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/customers')) return jsonResponse(customers);
    if (url.includes('/loan-products')) return jsonResponse([]);
    if (url.endsWith('/term-loans/quote')) return jsonResponse(quoteBody);
    if (url.endsWith('/term-loans')) {
      onDisburse?.(init);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return jsonResponse(disbursedBody, 201);
    }
    return jsonResponse({ code: 'NOT_FOUND', message: 'unexpected' }, 404);
  });
}

describe('LoanCreatePage', () => {
  it('shows validation messages without asking for a quote', async () => {
    const fetchSpy = mockApi();
    const user = userEvent.setup();
    renderCreatePage();
    await user.click(screen.getByRole('button', { name: /get quote/i }));
    expect(await screen.findByText('Enter the principal amount')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes('/quote'))).toHaveLength(0);
  });

  it('quotes, confirms parity, disburses once on a double click, then opens the new loan with its posted entry', async () => {
    let disbursementCount = 0;
    const idempotencyKeys: string[] = [];
    mockApi((init) => {
      disbursementCount += 1;
      idempotencyKeys.push((init?.headers as Record<string, string>)['Idempotency-Key'] ?? '');
    });
    const user = userEvent.setup();
    renderCreatePage();
    await fillAndQuote(user);

    expect(await screen.findByText('Client preview matches server')).toBeInTheDocument();
    await user.dblClick(screen.getByRole('button', { name: /approve and disburse/i }));

    expect(await screen.findByText('Landed on LN-1 with JE-1')).toBeInTheDocument();
    expect(screen.getByText('Loan disbursed')).toBeInTheDocument(); // toast survives the redirect
    expect(disbursementCount).toBe(1);
    expect(idempotencyKeys[0]).toMatch(/\S+/);
  });

  it('pre-selects the customer when opened from a customer page, and links back to them', async () => {
    mockApi();
    renderCreatePage('/loans/create?customerId=CUS-1');
    await waitFor(() => expect(screen.getByLabelText('Customer')).toHaveValue('CUS-1'));
    expect(screen.getByRole('link', { name: 'Chidi Okafor' })).toHaveAttribute('href', '/customers/CUS-1');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/customers/CUS-1');
  });

  it('after the first quote, re-quotes as the terms change — no second click — and disburses exactly what is shown', async () => {
    const quoteBodies: Array<{ principalKobo: number; annualRatePercent: number; termMonths: number }> = [];
    let postedBody: unknown = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/customers')) return jsonResponse(customers);
      if (url.includes('/loan-products')) return jsonResponse([]);
      if (url.endsWith('/term-loans/quote')) {
        const body = JSON.parse(String(init?.body)) as { principalKobo: number; annualRatePercent: number; termMonths: number };
        quoteBodies.push(body);
        const requested = { principalKobo: asKobo(body.principalKobo), annualRatePercent: body.annualRatePercent, termMonths: body.termMonths };
        const requestedSchedule = buildAmortisationSchedule(requested);
        return jsonResponse({ instalmentKobo: calculateMonthlyInstalmentKobo(requested), totalInterestKobo: sumInterestKobo(requestedSchedule), schedule: requestedSchedule });
      }
      if (url.endsWith('/term-loans')) {
        postedBody = JSON.parse(String(init?.body));
        return jsonResponse(disbursedBody, 201);
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'unexpected' }, 404);
    });
    const user = userEvent.setup();
    renderCreatePage();
    await fillAndQuote(user);
    expect((await screen.findAllByText('₦210,630.26')).length).toBeGreaterThan(0); // golden instalment

    await user.clear(screen.getByLabelText(/term \(months\)/i));
    await user.type(screen.getByLabelText(/term \(months\)/i), '12');
    expect(screen.getByRole('button', { name: /approve and disburse/i })).toBeDisabled();
    expect(screen.getByText('Updating the quote for your changes…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /approve and disburse/i })).toBeEnabled());
    expect(quoteBodies.at(-1)).toMatchObject({ principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 12 });
    expect(screen.getAllByRole('row')).toHaveLength(13); // header + 12 instalments

    await user.click(screen.getByRole('button', { name: /approve and disburse/i }));
    await waitFor(() => expect(postedBody).toMatchObject({ principalKobo: 120_000_000, termMonths: 12 }));
  });

  it('when disbursement is refused, says why in words and marks the field — never just "Validation failed"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/customers')) return jsonResponse(customers);
      if (url.includes('/loan-products')) return jsonResponse([]);
      if (url.endsWith('/term-loans/quote')) return jsonResponse(quoteBody);
      return jsonResponse(
        {
          statusCode: 422,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          errors: [{ field: 'principalKobo', message: 'Abakyraye loan lends ₦10,000.00 to ₦200,000.00. ₦1,200,000.00 is above that.' }],
        },
        422,
      );
    });
    const user = userEvent.setup();
    renderCreatePage();
    await fillAndQuote(user);
    await user.click(await screen.findByRole('button', { name: /approve and disburse/i }));

    expect(await screen.findByText('The loan was not disbursed')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/principal/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getAllByText('Abakyraye loan lends ₦10,000.00 to ₦200,000.00. ₦1,200,000.00 is above that.').length).toBeGreaterThanOrEqual(1);
  });

  it('places a server validation error against the right field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).includes('/customers') || String(input).includes('/loan-products')
        ? jsonResponse([])
        : jsonResponse({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Validation failed', errors: [{ field: 'annualRatePercent', message: 'Rate not allowed by policy' }] }, 422),
    );
    const user = userEvent.setup();
    renderCreatePage();
    await fillAndQuote(user);
    await waitFor(() => expect(screen.getByLabelText(/annual interest rate/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Rate not allowed by policy')).toBeInTheDocument();
  });
});
