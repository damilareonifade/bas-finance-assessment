import { Card, CardHeader } from '@/components/ui/Card';
import { initialsOf } from '@/lib/utils/initials';
import type { PortalOfficer } from '../schemas/portal';

interface PortalOfficerCardProps {
  readonly officer: PortalOfficer | null;
}

/** Who looks after this customer, and how to reach them. */
export function PortalOfficerCard({ officer }: PortalOfficerCardProps) {
  return (
    <Card>
      <CardHeader title="Your loan officer" />
      {officer ? (
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-base font-semibold text-surface">
            {initialsOf(officer.fullName)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{officer.fullName}</p>
            <a href={`mailto:${officer.email}`} className="block truncate text-sm text-brand hover:underline">
              {officer.email}
            </a>
            <p className="mt-1 text-xs text-ink-muted">Talk to them about payments, documents or a new loan.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">A loan officer has not been assigned to you yet. We will let you know here when one is.</p>
      )}
    </Card>
  );
}
