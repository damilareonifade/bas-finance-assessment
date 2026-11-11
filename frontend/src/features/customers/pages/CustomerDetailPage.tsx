import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/layout/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApplicationsTable, useApplicationsQuery } from '@/features/applications';
import { DocumentsPanel } from '@/features/customer-documents';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BanknoteIcon, BookIcon, ClipboardIcon, ReceiptIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/features/auth';
import { useAssignOfficerMutation, useCustomerQuery } from '../api/customerApi';
import { AssignOfficerPanel } from '../components/AssignOfficerPanel';
import { CustomerFacilitiesTables } from '../components/CustomerFacilitiesTables';
import { PortalAccessPanel } from '../components/PortalAccessPanel';
import { useOfficerOptions } from '../hooks/useOfficerOptions';

export default function CustomerDetailPage() {
  const { customerId = '' } = useParams();
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const toast = useToast();
  const customerQuery = useCustomerQuery(customerId);
  const assignMutation = useAssignOfficerMutation();
  const officerOptions = useOfficerOptions(isAdmin);
  const customer = customerQuery.data?.customer;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = (['history', 'applications', 'documents'] as const).find((candidate) => candidate === searchParams.get('tab')) ?? 'history';
  const applicationsQuery = useApplicationsQuery({ customerId });
  const newApplicationLink = `/applications/create?customerId=${encodeURIComponent(customerId)}`;

  const handleAssign = (officerId: string | null) =>
    assignMutation.mutate(
      { customerId, officerId },
      { onSuccess: ({ customer: updated }) => toast.success(updated.assignedOfficer ? `Assigned to ${updated.assignedOfficer.fullName}` : 'Loan officer removed') },
    );

  return (
    <>
      <PageHeader
        title={customer?.fullName ?? 'Customer'}
        breadcrumbs={[{ label: 'Customers', to: '/customers' }, { label: customer?.fullName ?? customerId }]}
        description={customer ? [customer.email, customer.phone].filter(Boolean).join(', ') || undefined : undefined}
        actions={
          customer ? (
            <>
              {isAdmin ? (
                <ButtonLink variant="secondary" to={`/ledger?customerId=${encodeURIComponent(customerId)}`}>
                  <BookIcon size={18} />
                  View ledger
                </ButtonLink>
              ) : null}
              <ButtonLink variant="secondary" to={`/invoices/create?customerId=${encodeURIComponent(customerId)}`}>
                <ReceiptIcon size={18} />
                Finance an invoice
              </ButtonLink>
              <ButtonLink variant="secondary" to={`/loans/create?customerId=${encodeURIComponent(customerId)}`}>
                <BanknoteIcon size={18} />
                New loan
              </ButtonLink>
              <ButtonLink to={newApplicationLink}>
                <ClipboardIcon size={18} />
                New application
              </ButtonLink>
            </>
          ) : null
        }
      />
      <Tabs
        label="Customer sections"
        activeId={tab}
        tabs={[
          { id: 'history', to: `/customers/${customerId}`, label: 'Profile and loan history' },
          { id: 'applications', to: `/customers/${customerId}?tab=applications`, label: applicationsQuery.data ? `Applications (${applicationsQuery.data.length})` : 'Applications' },
          { id: 'documents', to: `/customers/${customerId}?tab=documents`, label: 'Documents' },
        ]}
      />
      {tab === 'documents' && customer ? <DocumentsPanel customerId={customerId} /> : null}
      {tab === 'applications' ? (
        <section className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
          {applicationsQuery.isError ? <QueryError error={applicationsQuery.error} onRetry={() => void applicationsQuery.refetch()} /> : null}
          {applicationsQuery.isPending ? <TableSkeleton columnCount={7} rowCount={3} /> : null}
          {applicationsQuery.isSuccess ? (
            <ApplicationsTable
              applications={applicationsQuery.data}
              showApplicant={false}
              onOpen={(application) => navigate(`/applications/${application.applicationId}`)}
              emptyState={<EmptyState title="No applications yet" description="Applications this customer makes appear here." action={<ButtonLink to={newApplicationLink}>New application</ButtonLink>} />}
            />
          ) : null}
        </section>
      ) : null}
      <div className={tab === 'history' ? 'flex flex-col gap-6' : 'hidden'}>
        {customerQuery.isPending ? (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Card>
              <TableSkeleton columnCount={6} rowCount={3} />
            </Card>
          </>
        ) : null}
        {customerQuery.isError ? <QueryError error={customerQuery.error} onRetry={() => void customerQuery.refetch()} /> : null}
        {customerQuery.isSuccess && customer ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Loans / invoices" value={`${customer.loanCount} / ${customer.invoiceCount}`} />
              <StatCard label="Outstanding principal" value={<MoneyText kobo={customer.outstandingPrincipalKobo} />} />
              <StatCard label="Overdue" value={<MoneyText kobo={customer.overdueKobo} />} tone={customer.overdueKobo > 0 ? 'danger' : 'neutral'} />
              <StatCard label="Loan officer" value={customer.assignedOfficer?.fullName ?? 'Unassigned'} />
            </dl>
            {isAdmin ? (
              <AssignOfficerPanel
                key={customer.assignedOfficer?.userId ?? 'none'}
                assignedOfficerId={customer.assignedOfficer?.userId ?? null}
                officerOptions={officerOptions}
                isSaving={assignMutation.isPending}
                errorMessage={assignMutation.error?.message}
                onAssign={handleAssign}
              />
            ) : null}
            <PortalAccessPanel key={customer.email ?? ''} customerId={customerId} customerEmail={customer.email} isAdmin={isAdmin} />
            <CustomerFacilitiesTables loans={customerQuery.data.loans} invoices={customerQuery.data.invoices} customerId={customerId} />
          </>
        ) : null}
      </div>
    </>
  );
}
