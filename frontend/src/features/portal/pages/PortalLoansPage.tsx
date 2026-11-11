import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalLoansQuery } from '../api/portalApi';
import { PortalLoanCard } from '../components/PortalLoanCard';

export default function PortalLoansPage() {
  const loansQuery = usePortalLoansQuery();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My loans" description="Every loan you have with us. Open one to see its payment schedule and statement." actions={<ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>} />
      {loansQuery.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : null}
      {loansQuery.isError ? <QueryError error={loansQuery.error} onRetry={() => void loansQuery.refetch()} /> : null}
      {loansQuery.data && loansQuery.data.length === 0 ? (
        <Card>
          <EmptyState title="You have no loans with us yet" description="Apply online and your loan officer will review it." action={<ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>} />
        </Card>
      ) : null}
      {loansQuery.data && loansQuery.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {loansQuery.data.map((loan) => (
            <PortalLoanCard key={loan.loanId} loan={loan} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
