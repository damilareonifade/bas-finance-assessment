import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MoneyText } from '@/components/ui/MoneyText';
import { cn } from '@/lib/utils/cn';
import type { PortalInvoice } from '../schemas/portal';
import { formatPortalDate } from './dates';
import { PortalInvoiceStatusChip } from './PortalInvoiceStatusChip';

interface PortalInvoiceCardProps {
  readonly invoice: PortalInvoice;
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

/** One financed invoice, full width: what it was worth, what we paid the customer, and where the reserve stands. */
export function PortalInvoiceCard({ invoice }: PortalInvoiceCardProps) {
  const isSettled = invoice.status === 'SETTLED';
  return (
    <Link
      to={`/portal/invoices/${invoice.invoiceId}`}
      className="group block rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="font-semibold text-ink">{invoice.productName ?? 'Invoice financing'}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{invoice.invoiceId}</p>
        </div>
        <PortalInvoiceStatusChip status={invoice.status} />
      </div>

      <dl className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Invoice value" hint={`Due from your customer ${formatPortalDate(invoice.dueDate)}`}>
          <MoneyText kobo={invoice.faceValueKobo} />
        </Figure>
        <Figure label="Advance paid to you" hint={`80% of the invoice, on ${formatPortalDate(invoice.issueDate)}`}>
          <MoneyText kobo={invoice.advanceKobo} />
        </Figure>
        <Figure
          label={isSettled ? 'Reserve paid to you' : 'Reserve we are holding'}
          hint={isSettled ? `After our charges, on ${formatPortalDate(invoice.settledOn ?? invoice.dueDate)}` : 'Paid out, less charges, when your customer pays'}
        >
          <MoneyText kobo={isSettled ? invoice.reserveReleasedKobo : invoice.reserveKobo} />
        </Figure>
        <Figure label="Total paid to you" hint={isSettled ? 'Advance + reserve paid back' : 'So far — the advance'} isHighlighted>
          <MoneyText kobo={invoice.totalPaidToYouKobo} />
        </Figure>
      </dl>

      {invoice.status === 'OVERDUE' || invoice.youOweKobo > 0 ? (
        <div className="mx-6 mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {invoice.status === 'OVERDUE' ? (
            <p>
              {invoice.daysOverdue} day{invoice.daysOverdue === 1 ? '' : 's'} overdue — a late penalty of <MoneyText kobo={invoice.latePenaltyPerDayKobo} /> a day is coming out of your reserve.
            </p>
          ) : null}
          {invoice.youOweKobo > 0 ? (
            <p>
              Our charges were more than the reserve: you owe us <MoneyText kobo={invoice.youOweKobo} />.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
        <p className="text-xs text-ink-muted">{invoice.tenorDays}-day invoice</p>
        <span className="text-sm font-medium text-brand group-hover:underline">See the full breakdown</span>
      </div>
    </Link>
  );
}
