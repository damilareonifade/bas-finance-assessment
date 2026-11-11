import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Card, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { usePortalInvoiceQuery } from '../api/portalApi';
import { formatPortalDate } from '../components/dates';
import { PortalInvoiceStatusChip } from '../components/PortalInvoiceStatusChip';
import type { PortalInvoice } from '../schemas/portal';

interface BreakdownRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
  readonly isTotal?: boolean;
}

function BreakdownRow({ label, hint, children, isTotal = false }: BreakdownRowProps) {
  return (
    <div className={isTotal ? 'flex items-start justify-between gap-4 border-t border-line pt-3' : 'flex items-start justify-between gap-4'}>
      <dt>
        <span className={isTotal ? 'font-semibold text-ink' : 'text-ink'}>{label}</span>
        {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      </dt>
      <dd className={isTotal ? 'font-semibold text-ink tabular-nums' : 'text-ink tabular-nums'}>{children}</dd>
    </div>
  );
}

/** Settled: what happened at settlement. Open: what would happen if the debtor paid today. */
function ReserveBreakdown({ invoice }: { readonly invoice: PortalInvoice }) {
  const isSettled = invoice.status === 'SETTLED';
  const reserveBackKobo = isSettled ? invoice.reserveReleasedKobo : (invoice.ifSettledToday?.reserveReleasedKobo ?? invoice.reserveKobo);
  const owedKobo = isSettled ? invoice.youOweKobo : (invoice.ifSettledToday?.youOweKobo ?? invoice.youOweKobo);
  return (
    <Card>
      <CardHeader
        title={isSettled ? `What happened at settlement · ${formatPortalDate(invoice.settledOn ?? invoice.dueDate)}` : 'What you would get back if your customer paid today'}
        description="Our charges come out of the reserve; whatever is left is paid to you."
      />
      <dl className="flex flex-col gap-3 text-sm">
        <BreakdownRow label="Reserve held back">
          <MoneyText kobo={invoice.reserveKobo} />
        </BreakdownRow>
        <BreakdownRow label="Discount fee" hint={`36% a year on the advance, for ${invoice.tenorDays} days`}>
          − <MoneyText kobo={invoice.discountFeeKobo} />
        </BreakdownRow>
        <BreakdownRow
          label="Late penalty"
          hint={invoice.daysOverdue > 0 ? `${invoice.daysOverdue} day${invoice.daysOverdue === 1 ? '' : 's'} late, 0.2% of the advance a day` : 'None so far — not late'}
        >
          − <MoneyText kobo={invoice.latePenaltyKobo} />
        </BreakdownRow>
        <BreakdownRow label={isSettled ? 'Paid to you' : 'You would receive'} isTotal>
          <MoneyText kobo={reserveBackKobo} />
        </BreakdownRow>
        {owedKobo > 0 ? (
          <BreakdownRow label={isSettled ? 'You owe us' : 'You would owe us'} hint="Charges were more than the reserve">
            <span className="text-danger">
              <MoneyText kobo={owedKobo} />
            </span>
          </BreakdownRow>
        ) : null}
      </dl>
    </Card>
  );
}

export default function PortalInvoicePage() {
  const { invoiceId = '' } = useParams();
  const invoiceQuery = usePortalInvoiceQuery(invoiceId);
  const invoice = invoiceQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={invoice ? `${invoice.productName ?? 'Invoice financing'} · ${invoice.invoiceId}` : 'Your invoice'}
        breadcrumbs={[{ label: 'My invoices', to: '/portal/invoices' }, { label: invoiceId }]}
        description={invoice ? `Financed ${formatPortalDate(invoice.issueDate)} · due from your customer ${formatPortalDate(invoice.dueDate)}` : undefined}
        actions={invoice ? <PortalInvoiceStatusChip status={invoice.status} /> : undefined}
      />
      {invoiceQuery.isPending ? <Skeleton className="h-64 w-full rounded-xl" /> : null}
      {invoiceQuery.isError ? <QueryError error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} /> : null}
      {invoice ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Invoice value" value={<MoneyText kobo={invoice.faceValueKobo} />} />
            <StatCard label="Advance paid to you" value={<MoneyText kobo={invoice.advanceKobo} />} hint={`80% of the invoice, on ${formatPortalDate(invoice.issueDate)}`} />
            <StatCard
              label={invoice.status === 'SETTLED' ? 'Reserve paid to you' : 'Reserve we are holding'}
              value={<MoneyText kobo={invoice.status === 'SETTLED' ? invoice.reserveReleasedKobo : invoice.reserveKobo} />}
              hint={invoice.status === 'SETTLED' ? 'After our charges' : 'Paid out, less charges, when your customer pays'}
            />
            <StatCard label="Total paid to you" value={<MoneyText kobo={invoice.totalPaidToYouKobo} />} tone="success" />
          </dl>

          {invoice.status === 'OVERDUE' ? (
            <Alert tone="danger" title={`${invoice.daysOverdue} day${invoice.daysOverdue === 1 ? '' : 's'} past the due date`}>
              A late penalty of <MoneyText kobo={invoice.latePenaltyPerDayKobo} /> a day comes out of your reserve until your customer pays. Talk to your loan officer if you need help.
            </Alert>
          ) : null}
          {invoice.status === 'SETTLED' && invoice.youOweKobo > 0 ? (
            <Alert tone="danger" title="You owe us on this invoice">
              Our charges came to more than the reserve, so <MoneyText kobo={invoice.youOweKobo} /> is still due from you. Your loan officer will be in touch.
            </Alert>
          ) : null}

          <ReserveBreakdown invoice={invoice} />
        </>
      ) : null}
    </div>
  );
}
