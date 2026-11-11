import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalInvoicesQuery } from '../api/portalApi';
import { PortalInvoiceCard } from '../components/PortalInvoiceCard';

export default function PortalInvoicesPage() {
  const invoicesQuery = usePortalInvoicesQuery();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My invoices" description="Invoices we have financed for you: what we paid you up front, and the reserve we pay out once your customer pays." />
      {invoicesQuery.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : null}
      {invoicesQuery.isError ? <QueryError error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} /> : null}
      {invoicesQuery.data && invoicesQuery.data.length === 0 ? (
        <Card>
          <EmptyState title="No financed invoices yet" description="If you would like us to pay you early on an invoice, talk to your loan officer." />
        </Card>
      ) : null}
      {invoicesQuery.data && invoicesQuery.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {invoicesQuery.data.map((invoice) => (
            <PortalInvoiceCard key={invoice.invoiceId} invoice={invoice} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
