import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { asKobo, buildAmortisationSchedule } from '@/lib/money';
import { DecisionPanel } from '../components/DecisionPanel';
import { applicationFormSchema, type LoanApplicationDetail } from '../schemas/application';

describe('applicationFormSchema', () => {
  const base = { customerIdInput: 'CUS-1', loanProductIdInput: '', principalInput: '1,200,000', annualRatePercentInput: '18', termMonthsInput: '6', purposeInput: '' };

  it('turns what was typed into an application request in kobo', () => {
    expect(applicationFormSchema.parse(base)).toEqual({ customerId: 'CUS-1', loanProductId: undefined, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6, purpose: undefined });
  });

  it('needs an applicant and sensible terms, naming each field', () => {
    const result = applicationFormSchema.safeParse({ ...base, customerIdInput: '', principalInput: '1.234', termMonthsInput: '61' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => String(issue.path[0])).sort()).toEqual(['customerIdInput']);
    const terms = applicationFormSchema.safeParse({ ...base, principalInput: '1.234', termMonthsInput: '61' });
    expect(terms.success).toBe(false);
    if (!terms.success) expect(terms.error.issues.map((issue) => String(issue.path[0])).sort()).toEqual(['principalInput', 'termMonthsInput']);
  });
});

const terms = { principalKobo: asKobo(120_000_000), annualRatePercent: 18, termMonths: 6 };
function application(overrides: Partial<LoanApplicationDetail> = {}): LoanApplicationDetail {
  return {
    applicationId: 'APP-000001', status: 'UNDER_REVIEW',
    customer: { customerId: 'CUS-1', fullName: 'Chidi Okafor', email: null, phone: null },
    product: null, ...terms, purpose: null,
    assignedOfficer: { userId: 'USR-2', fullName: 'Ada Okoye' },
    channel: 'STAFF', submittedBy: { userId: 'USR-2', fullName: 'Ada Okoye' }, submittedAt: '2026-11-01T09:00:00Z',
    reviewedBy: null, reviewStartedAt: null, decidedBy: null, decidedAt: null, rejectionReason: null, loanId: null,
    verification: { requested: 0, awaitingReview: 0, verified: 2, rejected: 0 },
    customerOfficer: null,
    quote: { instalmentKobo: asKobo(21_063_026), totalInterestKobo: asKobo(6_378_154), schedule: buildAmortisationSchedule(terms) as LoanApplicationDetail['quote']['schedule'] },
    ...overrides,
  };
}
const officers = [{ value: 'USR-2', label: 'Ada Okoye' }, { value: 'USR-3', label: 'Bola Adeyemi' }];

function renderPanel(props: Partial<React.ComponentProps<typeof DecisionPanel>> = {}) {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  render(
    <DecisionPanel
      application={application()}
      isAdmin
      currentUserName="Administrator"
      officerOptions={officers}
      isApproving={false}
      isRejecting={false}
      approveError={null}
      rejectError={null}
      onApprove={onApprove}
      onReject={onReject}
      {...props}
    />,
  );
  return { onApprove, onReject };
}

describe('DecisionPanel', () => {
  it('approves with the chosen loan officer and date, reusing one idempotency key across clicks', async () => {
    const user = userEvent.setup();
    const { onApprove } = renderPanel();
    expect(screen.getByLabelText('Loan officer for this loan')).toHaveValue('USR-2');
    await user.selectOptions(screen.getByLabelText('Loan officer for this loan'), 'USR-3');
    await user.click(screen.getByRole('button', { name: 'Approve and disburse' }));
    await user.click(screen.getByRole('button', { name: 'Approve and disburse' }));
    expect(onApprove).toHaveBeenCalledTimes(2);
    const [first, second] = onApprove.mock.calls.map(([input]) => input as { officerId: string; idempotencyKey: string; disbursedOn: string });
    expect(first?.officerId).toBe('USR-3');
    expect(first?.disbursedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
  });

  it('a loan officer cannot pick someone else — the loan is theirs', async () => {
    const user = userEvent.setup();
    const { onApprove } = renderPanel({ isAdmin: false, currentUserName: 'Ada Okoye' });
    expect(screen.queryByLabelText('Loan officer for this loan')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Okoye (you)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve and disburse' }));
    expect((onApprove.mock.calls[0]?.[0] as { officerId?: string }).officerId).toBeUndefined();
  });

  it('warns when documents are not verified yet', () => {
    renderPanel({ application: application({ verification: { requested: 1, awaitingReview: 1, verified: 0, rejected: 0 } }) });
    expect(screen.getByText("Check the applicant's documents first")).toBeInTheDocument();
    expect(screen.getByText(/No document has been verified yet/)).toBeInTheDocument();
    expect(screen.getByText(/2 verifications are still open/)).toBeInTheDocument();
  });

  it('rejects with the reason typed', async () => {
    const user = userEvent.setup();
    const { onReject } = renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Reject' }));
    await user.type(screen.getByLabelText('Reason'), 'BVN does not match');
    await user.click(screen.getByRole('button', { name: 'Reject application' }));
    expect(onReject).toHaveBeenCalledWith('BVN does not match');
  });
});
