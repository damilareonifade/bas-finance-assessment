import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { LoanTabs, useTermLoanQuery } from '@/features/term-loans';
import { useLoanStatementQuery } from '../api/statementApi';
import { StatementTable } from '../components/StatementTable';
import { TieOutIndicator } from '../components/TieOutIndicator';
import { buildStatementRows, calculateScheduleOutstandingPrincipalKobo, calculateTieOut, statementClosingBalanceKobo } from '../statementMath';

export default function StatementPage() {
  const { loanId = '' } = useParams();
  const statementQuery = useLoanStatementQuery(loanId);
  const loanQuery = useTermLoanQuery(loanId);

  const statementRows = useMemo(() => buildStatementRows(statementQuery.data?.lines ?? []), [statementQuery.data]);

  const isPending = statementQuery.isPending || loanQuery.isPending;
  const error = statementQuery.error ?? loanQuery.error;

  const statementClosingKobo = statementClosingBalanceKobo(statementRows);
  const scheduleOutstandingKobo = loanQuery.data ? calculateScheduleOutstandingPrincipalKobo(loanQuery.data.schedule) : null;

  return (
    <>
      <PageHeader
        title={`Loan ${loanId}`}
        breadcrumbs={[{ label: 'Loans', to: '/loans' }, { label: loanId, to: `/loans/${loanId}` }, { label: 'Statement' }]}
        description="Built from the loan's ledger lines, with a running principal balance."
      />
      <LoanTabs loanId={loanId} activeId="statement" />
      <div className="flex flex-col gap-6">
        {isPending ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Card><TableSkeleton columnCount={6} /></Card>
          </>
        ) : null}
        {error ? (
          <QueryError
            error={error}
            onRetry={() => {
              void statementQuery.refetch();
              void loanQuery.refetch();
            }}
          />
        ) : null}
        {!isPending && !error && scheduleOutstandingKobo !== null ? (
          <>
            <TieOutIndicator
              statementClosingKobo={statementClosingKobo}
              scheduleOutstandingKobo={scheduleOutstandingKobo}
              tieOut={calculateTieOut(statementClosingKobo, scheduleOutstandingKobo)}
            />
            <Card>
              <StatementTable rows={statementRows} />
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
