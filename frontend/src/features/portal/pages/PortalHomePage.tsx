import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { addKobo, ZERO_KOBO } from '@/lib/money';
import { usePortalOverviewQuery } from '../api/portalApi';
import { PortalApplicationsList } from '../components/PortalApplicationsList';
import { PortalInvoiceCard } from '../components/PortalInvoiceCard';
import { PortalLoanCard } from '../components/PortalLoanCard';
import { PortalOfficerCard } from '../components/PortalOfficerCard';
import { useCurrentCustomer } from '../components/RequirePortalAuth';

interface SectionHeadingProps {
  readonly id: string;
  readonly title: string;
  readonly viewAllTo?: string;
}

function SectionHeading({ id, title, viewAllTo }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {viewAllTo ? (
        <Link to={viewAllTo} className="text-sm font-medium text-brand hover:underline">
          View all
        </Link>
      ) : null}
    </div>
  );
}

export default function PortalHomePage() {
  const customer = useCurrentCustomer();
  const overviewQuery = usePortalOverviewQuery();
  const firstName = customer.fullName.trim().split(/\s+/)[0] ?? customer.fullName;

  if (overviewQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (overviewQuery.isError) return <QueryError error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />;

  const { loans, invoices, applications, documents, officer } = overviewQuery.data;
  const openApplications = applications.filter((application) => application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW');
  const documentsToDo = documents.toProvide + documents.needsAttention;
  const stillToRepayKobo = loans.reduce((total, loan) => addKobo(total, loan.outstandingPrincipalKobo), ZERO_KOBO);
  const pastDueKobo = loans.reduce((total, loan) => addKobo(total, loan.overdueKobo), ZERO_KOBO);
  const paidOnInvoicesKobo = invoices.reduce((total, invoice) => addKobo(total, invoice.totalPaidToYouKobo), ZERO_KOBO);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-strong">Hello, {firstName}</h1>
          <p className="mt-1 text-sm text-ink-muted">Here is where your loans and invoices stand.</p>
        </div>
        <ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>
      </div>

      {documentsToDo > 0 ? (
        <Alert tone="warning">
          {documents.toProvide > 0 ? `We need ${documents.toProvide} document${documents.toProvide === 1 ? '' : 's'} from you. ` : ''}
          {documents.needsAttention > 0 ? `${documents.needsAttention} document${documents.needsAttention === 1 ? ' needs' : 's need'} uploading again. ` : ''}
          <Link to="/portal/documents" className="font-medium underline">
            Go to documents
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <dl className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="Still to repay on loans" value={<MoneyText kobo={stillToRepayKobo} />} hint={`${loans.length} loan${loans.length === 1 ? '' : 's'}`} />
          <StatCard label="Past due" value={<MoneyText kobo={pastDueKobo} />} tone={pastDueKobo > 0 ? 'danger' : 'neutral'} hint={pastDueKobo > 0 ? 'Please pay as soon as you can' : 'Nothing late'} />
          <StatCard label="Paid to you on invoices" value={<MoneyText kobo={paidOnInvoicesKobo} />} hint={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`} />
        </dl>
        <PortalOfficerCard officer={officer} />
      </div>

      <section aria-labelledby="loans-heading" className="flex flex-col gap-4">
        <SectionHeading id="loans-heading" title="Your loans" viewAllTo={loans.length > 2 ? '/portal/loans' : undefined} />
        {loans.length === 0 ? (
          <Card>
            <EmptyState title="You have no loans with us yet" description="Apply online and your loan officer will review it." action={<ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>} />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {loans.slice(0, 2).map((loan) => (
              <PortalLoanCard key={loan.loanId} loan={loan} />
            ))}
          </div>
        )}
      </section>

      {invoices.length > 0 ? (
        <section aria-labelledby="invoices-heading" className="flex flex-col gap-4">
          <SectionHeading id="invoices-heading" title="Your invoices" viewAllTo={invoices.length > 2 ? '/portal/invoices' : undefined} />
          <div className="flex flex-col gap-4">
            {invoices.slice(0, 2).map((invoice) => (
              <PortalInvoiceCard key={invoice.invoiceId} invoice={invoice} />
            ))}
          </div>
        </section>
      ) : null}

      {openApplications.length > 0 ? (
        <Card>
          <CardHeader title="Applications in progress" description="We will notify you here as soon as a decision is made." />
          <PortalApplicationsList applications={openApplications} />
        </Card>
      ) : null}
    </div>
  );
}
