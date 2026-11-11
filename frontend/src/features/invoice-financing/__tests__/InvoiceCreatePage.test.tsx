import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/AppProviders';
import { daysBetween, type CalendarDate } from '@/lib/dates/calendarDate';
import { asKobo, calculateInvoiceSettlement } from '@/lib/money';
import { jsonResponse } from '@/test/renderWithProviders';
import InvoiceCreatePage from '../pages/InvoiceCreatePage';

afterEach(() => vi.restoreAllMocks());

interface QuoteBody {
  readonly faceValueKobo: number;
  readonly issueDate: CalendarDate;
  readonly dueDate: CalendarDate;
}

/** A stand-in server that quotes with the same kernel, and records what was asked for and what was posted. */
function mockApi() {
  const quoteRequests: QuoteBody[] = [];
  const financeRequests: QuoteBody[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/customers') || url.includes('/loan-products')) return jsonResponse([]);
    const body = JSON.parse(String(init?.body ?? '{}')) as QuoteBody;
    if (url.endsWith('/invoices/quote')) {
      quoteRequests.push(body);
      const tenorDays = daysBetween(body.issueDate, body.dueDate);
      const outcome = calculateInvoiceSettlement({ faceValueKobo: asKobo(body.faceValueKobo), tenorDays, daysOverdue: 0 });
      return jsonResponse({ tenorDays, advanceKobo: outcome.advanceKobo, reserveKobo: outcome.reserveKobo, discountFeeKobo: outcome.discountFeeKobo, latePenaltyPerDayKobo: 160_000 });
    }
    if (url.endsWith('/invoices')) {
      financeRequests.push(body);
      return jsonResponse({ statusCode: 503, code: 'TEST_STOP', message: 'Stopped by the test' }, 503);
    }
    return jsonResponse({ code: 'NOT_FOUND', message: 'unexpected' }, 404);
  });
  return { quoteRequests, financeRequests };
}

function renderPage() {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/invoices/create']}>
        <Routes>
          <Route path="/invoices/create" element={<InvoiceCreatePage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

const approveButton = () => screen.getByRole('button', { name: /approve and pay advance/i });

describe('InvoiceCreatePage — live quote', () => {
  it('waits for the first "Get quote", then re-quotes on every change without another click', async () => {
    const { quoteRequests } = mockApi();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/invoice face value/i), '1,000,000');
    fireEvent.change(screen.getByLabelText(/advance date/i), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-11-30' } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(quoteRequests).toHaveLength(0); // nothing is quoted until they ask once

    await user.click(screen.getByRole('button', { name: /get quote/i }));
    expect(await screen.findByText('₦800,000.00')).toBeInTheDocument();
    expect(screen.getByText('Discount fee (18 days at 36%)')).toBeInTheDocument();

    // Change the amount: the old figures are greyed out and cannot be approved until the new quote lands.
    await user.clear(screen.getByLabelText(/invoice face value/i));
    await user.type(screen.getByLabelText(/invoice face value/i), '2,000,000');
    expect(approveButton()).toBeDisabled();
    expect(screen.getByText('Updating the quote for your changes…')).toBeInTheDocument();

    expect(await screen.findByText('₦1,600,000.00')).toBeInTheDocument();
    expect(approveButton()).toBeEnabled();
    expect(quoteRequests.at(-1)?.faceValueKobo).toBe(200_000_000);

    // Change a date: the tenor and fee follow.
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-12-12' } });
    expect(await screen.findByText('Discount fee (30 days at 36%)')).toBeInTheDocument();
  });

  it('asks for a fix instead of re-quoting while the form is invalid', async () => {
    const { quoteRequests } = mockApi();
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/invoice face value/i), '1,000,000');
    fireEvent.change(screen.getByLabelText(/advance date/i), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-11-30' } });
    await user.click(screen.getByRole('button', { name: /get quote/i }));
    await screen.findByText('₦800,000.00');
    const quotesSoFar = quoteRequests.length;

    await user.clear(screen.getByLabelText(/invoice face value/i));
    expect(screen.getByText('Fix the highlighted fields to update the quote.')).toBeInTheDocument();
    expect(approveButton()).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(quoteRequests).toHaveLength(quotesSoFar);
  });

  it('posts exactly the request the visible quote was made for', async () => {
    const { financeRequests } = mockApi();
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/invoice face value/i), '1,000,000');
    fireEvent.change(screen.getByLabelText(/advance date/i), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-11-30' } });
    await user.click(screen.getByRole('button', { name: /get quote/i }));
    await screen.findByText('₦800,000.00');

    await user.clear(screen.getByLabelText(/invoice face value/i));
    await user.type(screen.getByLabelText(/invoice face value/i), '2,000,000');
    await screen.findByText('₦1,600,000.00');
    await user.click(approveButton());

    await waitFor(() => expect(financeRequests).toHaveLength(1));
    expect(financeRequests[0]).toMatchObject({ faceValueKobo: 200_000_000, issueDate: '2026-11-12', dueDate: '2026-11-30' });
  });
});
