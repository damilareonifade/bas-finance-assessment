import { useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusCircleIcon } from '@/components/ui/icons';
import { QueryError } from '@/components/ui/QueryState';
import { SelectField } from '@/components/ui/SelectField';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useCurrentUser } from '@/features/auth';
import { useCustomersQuery } from '../api/customerApi';
import { CustomersTable } from '../components/CustomersTable';
import { useOfficerOptions } from '../hooks/useOfficerOptions';

/** Filters live in the URL (?search=&officerId=&unassigned=true) so other pages can link straight to a filtered list. */
export default function CustomersListPage() {
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get('search') ?? '';
  const officerFilter = searchParams.get('officerId') ?? '';
  const unassignedOnly = searchParams.get('unassigned') === 'true';
  const search = useDeferredValue(searchText.trim());

  const customersQuery = useCustomersQuery({ search, officerId: officerFilter || undefined, unassignedOnly });
  const officerOptions = useOfficerOptions(isAdmin);
  const isFiltered = searchText !== '' || officerFilter !== '' || unassignedOnly;

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

  const newCustomerButton = (
    <ButtonLink to="/customers/create">
      <PlusCircleIcon size={18} />
      New customer
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumbs={[{ label: 'Customers' }]}
        description={isAdmin ? 'Every customer, and the loan officer who owns the relationship.' : 'The customers assigned to you.'}
        actions={newCustomerButton}
      />
      <section className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-end gap-4 border-b border-line px-6 py-4">
          <div className="w-full sm:w-72">
            <TextField label="Search" placeholder="Name, email or phone" value={searchText} onChange={(event) => setFilter('search', event.target.value)} />
          </div>
          {isAdmin ? (
            <>
              <div className="w-full sm:w-56">
                <SelectField label="Loan officer" options={officerOptions} placeholder="All officers" value={officerFilter} onChange={(event) => setFilter('officerId', event.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-3 text-sm">
                <input type="checkbox" className="size-4 accent-brand" checked={unassignedOnly} onChange={(event) => setFilter('unassigned', event.target.checked ? 'true' : '')} />
                Unassigned only
              </label>
            </>
          ) : null}
        </div>
        <div className="px-3 py-2">
          {customersQuery.isPending ? <TableSkeleton columnCount={6} /> : null}
          {customersQuery.isError ? <QueryError error={customersQuery.error} onRetry={() => void customersQuery.refetch()} /> : null}
          {customersQuery.isSuccess ? (
            <CustomersTable
              customers={customersQuery.data}
              onOpen={(customer) => navigate(`/customers/${customer.customerId}`)}
              emptyState={
                isFiltered ? (
                  <EmptyState title="No customers match these filters" description="Clear the search or filters to see everyone." />
                ) : (
                  <EmptyState title="No customers yet" description="Add a customer to start lending to them." action={newCustomerButton} />
                )
              }
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
