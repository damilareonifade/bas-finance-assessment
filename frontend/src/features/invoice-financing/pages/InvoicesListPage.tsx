import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusCircleIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useCustomerDirectory } from '@/features/customers';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { useInvoicesQuery } from '../api/invoiceApi';
import type { Invoice } from '../schemas/invoice';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';

export default function InvoicesListPage() {
  const navigate = useNavigate();
  const invoicesQuery = useInvoicesQuery();
  const customerDirectory = useCustomerDirectory();
  const today = todayCalendarDate();

  const columns: ReadonlyArray<DataTableColumn<Invoice>> = [
    {
      key: 'id',
      header: 'Invoice',
      render: (invoice) => (
        <Link className="font-medium text-brand hover:underline" to={`/invoices/${invoice.invoiceId}`}>
          {invoice.invoiceId}
        </Link>
      ),
    },
    { key: 'customer', header: 'Client', render: (invoice) => customerDirectory.nameOf(invoice.customerId) ?? '—' },
    { key: 'face', header: 'Face value', align: 'right', render: (invoice) => <MoneyText kobo={invoice.faceValueKobo} /> },
    { key: 'advance', header: 'Advance', align: 'right', render: (invoice) => <MoneyText kobo={invoice.advanceKobo} /> },
    { key: 'due', header: 'Due', render: (invoice) => invoice.dueDate },
    { key: 'status', header: 'Status', render: (invoice) => <InvoiceStatusBadge invoice={invoice} today={today} /> },
  ];

  const newInvoiceButton = (
    <ButtonLink to="/invoices/create">
      <PlusCircleIcon size={18} />
      Finance an invoice
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Invoices" breadcrumbs={[{ label: 'Invoices' }]} description="Financed invoices, and which are waiting to be settled." actions={newInvoiceButton} />
      <section className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
        {invoicesQuery.isPending ? <TableSkeleton columnCount={6} /> : null}
        {invoicesQuery.isError ? <QueryError error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} /> : null}
        {invoicesQuery.isSuccess ? (
          <DataTable
            caption="Invoices"
            columns={columns}
            rows={invoicesQuery.data}
            getRowKey={(invoice) => invoice.invoiceId}
            onRowClick={(invoice) => navigate(`/invoices/${invoice.invoiceId}`)}
            emptyState={<EmptyState title="No financed invoices yet" description="Advance cash against a client's invoice to see it here." action={newInvoiceButton} />}
          />
        ) : null}
      </section>
    </>
  );
}
