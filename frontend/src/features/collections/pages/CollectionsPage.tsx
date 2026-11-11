import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useCurrentUser } from '@/features/auth';
import { useTeamMembersQuery } from '@/features/team';
import { useCollectionsQuery } from '../api/collectionsApi';
import { CollectionsTable } from '../components/CollectionsTable';

/** The follow-up list: assigned customers ranked by what they owe, so the officer knows who to call first. */
export default function CollectionsPage() {
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const [officerId, setOfficerId] = useState('');
  const collectionsQuery = useCollectionsQuery(isAdmin && officerId ? officerId : undefined);
  const membersQuery = useTeamMembersQuery();

  const officerOptions = useMemo(
    () => (membersQuery.data ?? []).filter((member) => member.role === 'LOAN_OFFICER').map((member) => ({ value: member.userId, label: member.fullName })),
    [membersQuery.data],
  );

  return (
    <>
      <PageHeader
        title="Collections"
        description={collectionsQuery.data ? `As of ${collectionsQuery.data.asOf} — customers ranked by what is overdue.` : 'Customers ranked by what is overdue.'}
        actions={isAdmin ? <SelectField label="Officer" options={officerOptions} placeholder="All assigned customers" value={officerId} onChange={(event) => setOfficerId(event.target.value)} /> : null}
      />
      <div className="flex flex-col gap-6">
        {collectionsQuery.isPending ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Card><TableSkeleton columnCount={8} /></Card>
          </>
        ) : null}
        {collectionsQuery.isError ? <QueryError error={collectionsQuery.error} onRetry={() => void collectionsQuery.refetch()} /> : null}
        {collectionsQuery.isSuccess ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Customers" value={collectionsQuery.data.totals.customers} />
              <StatCard label="To chase" value={collectionsQuery.data.totals.customersToChase} tone={collectionsQuery.data.totals.customersToChase > 0 ? 'danger' : 'success'} />
              <StatCard label="Total overdue" value={<MoneyText kobo={collectionsQuery.data.totals.overdueKobo} />} tone={collectionsQuery.data.totals.overdueKobo > 0 ? 'danger' : 'neutral'} />
              <StatCard label="Outstanding principal" value={<MoneyText kobo={collectionsQuery.data.totals.outstandingPrincipalKobo} />} />
            </dl>
            <Card>
              <CollectionsTable rows={collectionsQuery.data.customers} showOfficer={isAdmin && officerId === ''} />
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
