import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SelectField } from '@/components/ui/SelectField';
import { useCurrentUser } from '@/features/auth';
import { useTeamMembersQuery } from '@/features/team';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusCircleIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { Badge } from '@/components/ui/Badge';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useCustomerDirectory, useOfficerOptions } from '@/features/customers';
import { useTermLoansQuery } from '../api/useTermLoanQueries';
import type { TermLoan } from '../schemas/termLoan';

export default function LoansListPage() {
  const navigate = useNavigate();
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const approvedBy = searchParams.get('approvedBy') ?? '';
  const officerId = searchParams.get('officerId') ?? '';
  const loansQuery = useTermLoansQuery({ approvedBy: approvedBy || undefined, officerId: officerId || undefined });
  const officerOptions = useOfficerOptions(isAdmin);
  const membersQuery = useTeamMembersQuery(isAdmin);
  const approverOptions = [
    { value: 'me', label: 'Me' },
    ...(membersQuery.data ?? []).filter((member) => member.status === 'ACTIVE').map((member) => ({ value: member.userId, label: member.fullName })),
  ];
  const setFilter = (key: string, value: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const customerDirectory = useCustomerDirectory();

  const columns: ReadonlyArray<DataTableColumn<TermLoan>> = [
    {
      key: 'id',
      header: 'Loan',
      render: (loan) => (
        <Link className="font-medium text-brand hover:underline" to={`/loans/${loan.loanId}`}>
          {loan.loanId}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (loan) => customerDirectory.nameOf(loan.customerId) ?? '—' },
    { key: 'principal', header: 'Principal', align: 'right', render: (loan) => <MoneyText kobo={loan.principalKobo} /> },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (loan) => (loan.outstandingPrincipalKobo === 0 ? <Badge tone="success">Repaid</Badge> : <MoneyText kobo={loan.outstandingPrincipalKobo} />),
    },
    { key: 'terms', header: 'Rate / term', align: 'right', render: (loan) => `${loan.annualRatePercent}% · ${loan.termMonths} mo` },
    { key: 'approvedBy', header: 'Approved by', render: (loan) => loan.approvedBy?.fullName ?? '—' },
    { key: 'officer', header: 'Loan officer', render: (loan) => loan.assignedOfficer?.fullName ?? '—' },
    { key: 'disbursed', header: 'Disbursed', render: (loan) => loan.disbursedOn },
  ];

  const newLoanButton = (
    <ButtonLink to="/loans/create">
      <PlusCircleIcon size={18} />
      New loan
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Loans" breadcrumbs={[{ label: 'Loans' }]} description="Term loans, newest first." actions={newLoanButton} />
      <section className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-end gap-4 border-b border-line px-6 py-4">
          {isAdmin ? (
            <>
              <div className="w-full sm:w-56">
                <SelectField label="Approved by" options={approverOptions} placeholder="Anyone" value={approvedBy} onChange={(event) => setFilter('approvedBy', event.target.value)} />
              </div>
              <div className="w-full sm:w-56">
                <SelectField label="Loan officer" options={officerOptions} placeholder="All officers" value={officerId} onChange={(event) => setFilter('officerId', event.target.value)} />
              </div>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand" checked={approvedBy === 'me'} onChange={(event) => setFilter('approvedBy', event.target.checked ? 'me' : '')} />
                Approved by me
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand" checked={officerId === 'me'} onChange={(event) => setFilter('officerId', event.target.checked ? 'me' : '')} />
                Assigned to me
              </label>
            </>
          )}
        </div>
        <div className="px-3 py-2">
        {loansQuery.isPending ? <TableSkeleton columnCount={8} /> : null}
        {loansQuery.isError ? <QueryError error={loansQuery.error} onRetry={() => void loansQuery.refetch()} /> : null}
        {loansQuery.isSuccess ? (
          <DataTable
            caption="Loans"
            columns={columns}
            rows={loansQuery.data}
            getRowKey={(loan) => loan.loanId}
            onRowClick={(loan) => navigate(`/loans/${loan.loanId}`)}
            emptyState={
              approvedBy || officerId ? (
                <EmptyState title="No loans match these filters" description="Clear a filter to see more." />
              ) : (
                <EmptyState title="No loans yet" description="Approve an application, or quote and disburse a loan directly." action={newLoanButton} />
              )
            }
          />
        ) : null}
        </div>
      </section>
    </>
  );
}
