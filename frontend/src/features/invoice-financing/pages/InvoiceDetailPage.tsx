import { useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { UsersIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { StatCard } from '@/components/ui/StatCard';
import { useCustomerDirectory } from '@/features/customers';
import { JournalEntryCard, readPostedEntry } from '@/features/ledger';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { useInvoiceQuery } from '../api/invoiceApi';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { SettlementPanel } from '../components/SettlementPanel';

/** An invoice's record page: its terms, and settlement while it is still open. */
export default function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const location = useLocation();
  const justPostedEntry = readPostedEntry(location.state);
  const invoiceQuery = useInvoiceQuery(invoiceId);
  const customerDirectory = useCustomerDirectory();
  const invoice = invoiceQuery.data;
  const customerName = customerDirectory.nameOf(invoice?.customerId ?? null);

  return (
    <>
      <PageHeader
        title={`Invoice ${invoiceId}`}
        breadcrumbs={[{ label: 'Invoices', to: '/invoices' }, { label: invoiceId }]}
        actions={
          invoice?.customerId ? (
            <ButtonLink variant="secondary" to={`/customers/${invoice.customerId}`}>
              <UsersIcon size={18} />
              {customerName ?? 'View customer'}
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        {justPostedEntry ? <JournalEntryCard journalEntry={justPostedEntry} title="Advance posted" /> : null}
        {invoiceQuery.isPending ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
        {invoiceQuery.isError ? <QueryError error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} /> : null}
        {invoice ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Face value" value={<MoneyText kobo={invoice.faceValueKobo} />} hint={`Due ${invoice.dueDate} (${invoice.tenorDays} days)`} />
              <StatCard label="Advance paid" value={<MoneyText kobo={invoice.advanceKobo} />} hint={`Advanced ${invoice.issueDate}`} />
              <StatCard label="Reserve held back" value={<MoneyText kobo={invoice.reserveKobo} />} hint={<>Discount fee <MoneyText kobo={invoice.discountFeeKobo} /></>} />
              <StatCard label="Status" value={<InvoiceStatusBadge invoice={invoice} today={todayCalendarDate()} />} />
            </dl>
            {invoice.status === 'ADVANCED' ? <SettlementPanel invoiceId={invoiceId} /> : null}
          </>
        ) : null}
      </div>
    </>
  );
}
