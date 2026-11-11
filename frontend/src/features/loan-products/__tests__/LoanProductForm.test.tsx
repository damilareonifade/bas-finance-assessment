import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LoanProductForm } from '../components/LoanProductForm';

function renderForm() {
  renderWithProviders(<LoanProductForm mode="create" isSubmitting={false} serverError={null} cancelTo="/products" onSubmit={vi.fn()} />);
}

describe('LoanProductForm — fixed invoice financing terms', () => {
  it('does not show the invoice terms for a term loan', () => {
    renderForm();
    expect(screen.queryByText('Invoice financing terms are fixed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Minimum amount (₦)')).toBeInTheDocument();
  });

  it('tells the admin the advance, discount fee and penalty are fixed when invoice financing is chosen', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'INVOICE_FINANCING');

    expect(screen.getByText('Invoice financing terms are fixed')).toBeInTheDocument();
    expect(screen.getByText('Advance: 80%')).toBeInTheDocument();
    expect(screen.getByText(/other 20% is held as a reserve/)).toBeInTheDocument();
    expect(screen.getByText('Discount fee: 36% a year')).toBeInTheDocument();
    expect(screen.getByText('Late penalty: 0.2% of the advance per day')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimum invoice face value (₦)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Minimum annual rate (%)')).not.toBeInTheDocument();
  });
});
