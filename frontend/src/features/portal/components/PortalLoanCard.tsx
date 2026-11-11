import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils/cn';
import type { PortalLoanSummary } from '../schemas/portal';
import { formatPortalDate } from './dates';

interface PortalLoanCardProps {
  readonly loan: PortalLoanSummary;
}

interface FigureProps {
  readonly label: string;
  readonly hint: string;
  readonly children: ReactNode;
  readonly isHighlighted?: boolean;
}

function Figure({ label, hint, children, isHighlighted = false }: FigureProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className={cn('text-xl font-semibold tabular-nums', isHighlighted ? 'text-brand-strong' : 'text-ink')}>{children}</dd>
      <dd className="text-xs text-ink-muted">{hint}</dd>
    </div>
  );
}

function LoanStatus({ loan }: PortalLoanCardProps) {
  if (loan.status === 'PAID_OFF') return <StatusChip tone="complete">Paid off</StatusChip>;
  if (loan.overdueKobo > 0) return <StatusChip tone="alert">Payment overdue</StatusChip>;
  return <StatusChip tone="good">On track</StatusChip>;
}

/** One loan, full width: what was borrowed, what is left, what is next, and the monthly payment. Same layout as invoice cards. */
export function PortalLoanCard({ loan }: PortalLoanCardProps) {
  return (
    <Link
      to={`/portal/loans/${loan.loanId}`}
      className="group block rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="font-semibold text-ink">{loan.productName ?? 'Term loan'}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{loan.loanId}</p>
        </div>
        <LoanStatus loan={loan} />
      </div>

      <dl className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Borrowed" hint={`Paid out to you on ${formatPortalDate(loan.disbursedOn)}`}>
          <MoneyText kobo={loan.principalKobo} />
        </Figure>
        <Figure label="Still to repay" hint="Principal outstanding" isHighlighted>
          <MoneyText kobo={loan.outstandingPrincipalKobo} />
        </Figure>
        <Figure label="Next payment" hint={loan.nextPayment ? `Due ${formatPortalDate(loan.nextPayment.dueDate)} · instalment ${loan.nextPayment.instalmentNumber} of ${loan.termMonths}` : 'Nothing more to pay'}>
          {loan.nextPayment ? <MoneyText kobo={loan.nextPayment.amountDueKobo} /> : 'All paid'}
        </Figure>
        <Figure label="Monthly payment" hint={`${loan.termMonths} months at ${loan.annualRatePercent}% a year`}>
          <MoneyText kobo={loan.instalmentKobo} />
        </Figure>
      </dl>

      {loan.overdueKobo > 0 ? (
        <div className="mx-6 mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          <MoneyText kobo={loan.overdueKobo} /> is past due. Please pay as soon as you can, or talk to your loan officer.
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
        <p className="text-xs text-ink-muted">{loan.status === 'PAID_OFF' ? 'This loan is fully repaid' : `${loan.termMonths}-month term loan`}</p>
        <span className="text-sm font-medium text-brand group-hover:underline">See schedule and statement</span>
      </div>
    </Link>
  );
}
