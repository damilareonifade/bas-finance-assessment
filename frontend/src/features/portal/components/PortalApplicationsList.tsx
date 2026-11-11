import { Link } from 'react-router-dom';
import { MoneyText } from '@/components/ui/MoneyText';
import { ApplicationStatusChip } from '@/features/applications/components/ApplicationStatusChip';
import type { PortalApplication } from '../schemas/portal';
import { formatPortalDate } from './dates';

interface PortalApplicationsListProps {
  readonly applications: readonly PortalApplication[];
}

/** The customer's loan applications, newest first, with the decision and a link to the loan once approved. */
export function PortalApplicationsList({ applications }: PortalApplicationsListProps) {
  return (
    <ul className="divide-y divide-line">
      {applications.map((application) => (
        <li key={application.applicationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-ink">
              <MoneyText kobo={application.principalKobo} /> over {application.termMonths} months{application.product ? ` · ${application.product.name}` : ''}
            </p>
            <p className="text-xs text-ink-muted">
              {application.applicationId} · applied {formatPortalDate(application.submittedAt)}
              {application.rejectionReason ? ` · ${application.rejectionReason}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ApplicationStatusChip status={application.status} />
            {application.loanId ? (
              <Link to={`/portal/loans/${application.loanId}`} className="text-sm font-medium text-brand hover:underline">
                View loan
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
