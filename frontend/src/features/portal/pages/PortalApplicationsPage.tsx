import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalApplicationsQuery } from '../api/portalApi';
import { PortalApplicationsList } from '../components/PortalApplicationsList';

export default function PortalApplicationsPage() {
  const applicationsQuery = usePortalApplicationsQuery();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Applications" description="Every loan you have applied for, and what was decided." actions={<ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>} />
      {applicationsQuery.isPending ? <Skeleton className="h-40 w-full rounded-xl" /> : null}
      {applicationsQuery.isError ? <QueryError error={applicationsQuery.error} onRetry={() => void applicationsQuery.refetch()} /> : null}
      {applicationsQuery.data ? (
        <Card>
          {applicationsQuery.data.length === 0 ? (
            <EmptyState title="No applications yet" description="Apply online and your loan officer will review it." action={<ButtonLink to="/portal/apply">Apply for a loan</ButtonLink>} />
          ) : (
            <PortalApplicationsList applications={applicationsQuery.data} />
          )}
        </Card>
      ) : null}
    </div>
  );
}
