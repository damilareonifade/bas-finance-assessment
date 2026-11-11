import { Link, useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { UsersIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useCustomerDirectory } from '@/features/customers';
import { JournalEntryCard, readPostedEntry } from '@/features/ledger';
import { AmortisationScheduleTable, LoanTabs, useTermLoanQuery } from '@/features/term-loans';
import { RepaymentPanel } from '../components/RepaymentPanel';

/** A loan's record page: summary, schedule, and taking a repayment. Statement is the second tab. */
export default function LoanDetailPage() {
  const { loanId = '' } = useParams();
  const location = useLocation();
  const justPostedEntry = readPostedEntry(location.state);
  const loanQuery = useTermLoanQuery(loanId);
  const customerDirectory = useCustomerDirectory();
  const loan = loanQuery.data;
  const customerName = customerDirectory.nameOf(loan?.customerId ?? null);

  return (
    <>
      <PageHeader
        title={`Loan ${loanId}`}
        breadcrumbs={[{ label: 'Loans', to: '/loans' }, { label: loanId }]}
        actions={
          loan?.customerId ? (
            <ButtonLink variant="secondary" to={`/customers/${loan.customerId}`}>
              <UsersIcon size={18} />
              {customerName ?? 'View customer'}
            </ButtonLink>
          ) : null
        }
      />
      <LoanTabs loanId={loanId} activeId="overview" />
      <div className="flex flex-col gap-6">
        {justPostedEntry ? <JournalEntryCard journalEntry={justPostedEntry} title="Disbursement posted" /> : null}

        {loanQuery.isPending ? (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Card>
              <TableSkeleton columnCount={7} />
            </Card>
          </>
        ) : null}
        {loanQuery.isError ? <QueryError error={loanQuery.error} onRetry={() => void loanQuery.refetch()} /> : null}
        {loan ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Principal" value={<MoneyText kobo={loan.principalKobo} />} hint={`Disbursed ${loan.disbursedOn}`} />
              <StatCard label="Outstanding principal" value={<MoneyText kobo={loan.outstandingPrincipalKobo} />} tone={loan.outstandingPrincipalKobo === 0 ? 'success' : 'neutral'} />
              <StatCard label="Rate and term" value={`${loan.annualRatePercent}%`} hint={`${loan.termMonths} monthly instalments`} />
              <StatCard
                label="Unapplied credit"
                value={<MoneyText kobo={loan.unappliedCreditKobo} />}
                hint={loan.customerId ? undefined : 'No customer on this loan'}
              />
            </dl>
            <dl className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Approved by" value={<span className="text-base">{loan.approvedBy?.fullName ?? '—'}</span>} hint={loan.approvedAt ? `on ${loan.approvedAt.slice(0, 10)}` : undefined} />
              <StatCard label="Loan officer" value={<span className="text-base">{loan.assignedOfficer?.fullName ?? 'Unassigned'}</span>} />
              <StatCard
                label="Application"
                value={
                  loan.applicationId ? (
                    <Link className="text-base text-brand hover:underline" to={`/applications/${loan.applicationId}`}>
                      {loan.applicationId}
                    </Link>
                  ) : (
                    <span className="text-base">Direct</span>
                  )
                }
                hint={loan.applicationId ? undefined : 'Disbursed without an application'}
              />
            </dl>
            <Card>
              <CardHeader
                title="Schedule"
                action={
                  <Link className="text-sm font-medium text-brand hover:underline" to={`/loans/${loanId}/statement`}>
                    View statement
                  </Link>
                }
              />
              <AmortisationScheduleTable schedule={loan.schedule} />
            </Card>
            <RepaymentPanel loanId={loanId} />
          </>
        ) : null}
      </div>
    </>
  );
}
