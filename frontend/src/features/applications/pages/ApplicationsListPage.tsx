import { useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/layout/Tabs';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusCircleIcon } from '@/components/ui/icons';
import { QueryError } from '@/components/ui/QueryState';
import { SelectField } from '@/components/ui/SelectField';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useCurrentUser } from '@/features/auth';
import { useOfficerOptions } from '@/features/customers';
import { useApplicationsQuery, type ApplicationFilters } from '../api/applicationsApi';
import { ApplicationsTable } from '../components/ApplicationsTable';
import { applicationStatusSchema } from '../schemas/application';

const STATUS_TABS = [
  { id: 'OPEN', label: 'Awaiting decision' },
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'UNDER_REVIEW', label: 'Under review' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
] as const;

/** Applicants: loans people have asked for. Filters live in the URL (?status=&officerId=&decidedBy=me&search=). */
export default function ApplicationsListPage() {
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? 'OPEN';
  const searchText = searchParams.get('search') ?? '';
  const officerId = searchParams.get('officerId') ?? '';
  const decidedByMe = searchParams.get('decidedBy') === 'me';
  const search = useDeferredValue(searchText.trim());
  const officerOptions = useOfficerOptions(isAdmin);

  const parsedStatus = applicationStatusSchema.safeParse(statusParam);
  const filters: ApplicationFilters = {
    status: statusParam === 'OPEN' ? 'OPEN' : parsedStatus.success ? parsedStatus.data : undefined,
    search: search || undefined,
    officerId: officerId || undefined,
    decidedBy: decidedByMe ? 'me' : undefined,
  };
  const applicationsQuery = useApplicationsQuery(filters);

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
  const tabLink = (statusId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('status', statusId);
    return `/applications?${next.toString()}`;
  };

  const newApplicationButton = (
    <ButtonLink to="/applications/create">
      <PlusCircleIcon size={18} />
      New application
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Applications" breadcrumbs={[{ label: 'Applications' }]} description="Loans people have asked for, from submission to decision." actions={newApplicationButton} />
      <Tabs label="Application status" activeId={statusParam} tabs={STATUS_TABS.map((tab) => ({ id: tab.id, label: tab.label, to: tabLink(tab.id) }))} />
      <section className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-end gap-4 border-b border-line px-6 py-4">
          <div className="w-full sm:w-72">
            <TextField label="Search" placeholder="Applicant or application ID" value={searchText} onChange={(event) => setFilter('search', event.target.value)} />
          </div>
          {isAdmin ? (
            <div className="w-full sm:w-56">
              <SelectField label="Loan officer" options={officerOptions} placeholder="All officers" value={officerId} onChange={(event) => setFilter('officerId', event.target.value)} />
            </div>
          ) : (
            <label className="flex items-center gap-2 pb-3 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={officerId === 'me'} onChange={(event) => setFilter('officerId', event.target.checked ? 'me' : '')} />
              Assigned to me
            </label>
          )}
          <label className="flex items-center gap-2 pb-3 text-sm">
            <input type="checkbox" className="size-4 accent-brand" checked={decidedByMe} onChange={(event) => setFilter('decidedBy', event.target.checked ? 'me' : '')} />
            Decided by me
          </label>
        </div>
        <div className="px-3 py-2">
          {applicationsQuery.isPending ? <TableSkeleton columnCount={8} /> : null}
          {applicationsQuery.isError ? <QueryError error={applicationsQuery.error} onRetry={() => void applicationsQuery.refetch()} /> : null}
          {applicationsQuery.isSuccess ? (
            <ApplicationsTable
              applications={applicationsQuery.data}
              onOpen={(application) => navigate(`/applications/${application.applicationId}`)}
              emptyState={
                statusParam === 'OPEN' && !search && !officerId && !decidedByMe ? (
                  <EmptyState title="Nothing is waiting for a decision" description="New applications appear here as they are submitted." action={newApplicationButton} />
                ) : (
                  <EmptyState title="No applications match" description="Try another status tab or clear the filters." />
                )
              }
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
