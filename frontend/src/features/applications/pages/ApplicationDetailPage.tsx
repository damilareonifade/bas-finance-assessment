import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { UsersIcon } from '@/components/ui/icons';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/features/auth';
import { useOfficerOptions } from '@/features/customers';
import type { PostedEntryState } from '@/features/ledger';
import { AmortisationScheduleTable } from '@/features/term-loans';
import { formatKobo } from '@/lib/money';
import {
  useApplicationQuery,
  useApproveApplicationMutation,
  useAssignApplicationOfficerMutation,
  useRejectApplicationMutation,
  useStartReviewMutation,
} from '../api/applicationsApi';
import { ApplicationStatusChip } from '../components/ApplicationStatusChip';
import { DashboardLikeCard } from '../components/DashboardLikeCard';
import { DecisionPanel } from '../components/DecisionPanel';
import { isOpen } from '../schemas/application';

function TimelineRow({ label, who, when }: { readonly label: string; readonly who: string | null | undefined; readonly when: string | null | undefined }) {
  if (!when) return null;
  return (
    <li className="flex justify-between gap-3 text-sm">
      <span className="text-ink">{label}{who ? <span className="text-ink-muted"> by {who}</span> : null}</span>
      <span className="shrink-0 text-ink-muted">{when.slice(0, 10)}</span>
    </li>
  );
}

export default function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  const applicationQuery = useApplicationQuery(applicationId);
  const officerOptions = useOfficerOptions(isAdmin);
  const startReview = useStartReviewMutation(applicationId);
  const assignOfficer = useAssignApplicationOfficerMutation(applicationId);
  const approve = useApproveApplicationMutation(applicationId);
  const reject = useRejectApplicationMutation(applicationId);
  const application = applicationQuery.data;

  const handleApprove = (input: { officerId?: string; disbursedOn: string; idempotencyKey: string }) => {
    if (approve.isPending) return;
    approve.mutate(input, {
      onSuccess: ({ loan, journalEntry }) => {
        toast.success('Application approved', `${loan.loanId} disbursed: ${formatKobo(loan.principalKobo)}.`);
        const state: PostedEntryState = { postedJournalEntry: journalEntry };
        navigate(`/loans/${loan.loanId}`, { state });
      },
    });
  };

  const handleReject = (reason: string) =>
    reject.mutate(reason, { onSuccess: () => toast.success('Application rejected', 'The submitter has been notified.') });

  return (
    <>
      <PageHeader
        title={application ? `${application.customer.fullName} — ${formatKobo(application.principalKobo)}` : `Application ${applicationId}`}
        breadcrumbs={[{ label: 'Applications', to: '/applications' }, { label: applicationId }]}
        description={application ? `${applicationId} · submitted ${application.submittedAt.slice(0, 10)}${application.channel === 'PORTAL' ? ' online by the applicant' : application.submittedBy ? ` by ${application.submittedBy.fullName}` : ''}` : undefined}
        actions={
          application ? (
            <>
              <ApplicationStatusChip status={application.status} />
              <ButtonLink variant="secondary" to={`/customers/${application.customer.customerId}`}>
                <UsersIcon size={18} />
                Applicant profile
              </ButtonLink>
              {application.status === 'SUBMITTED' ? (
                <Button isLoading={startReview.isPending} onClick={() => startReview.mutate(undefined, { onSuccess: () => toast.success('Review started') })}>
                  Start review
                </Button>
              ) : null}
            </>
          ) : null
        }
      />
      {applicationQuery.isPending ? <Skeleton className="h-96 w-full rounded-xl" /> : null}
      {applicationQuery.isError ? <QueryError error={applicationQuery.error} onRetry={() => void applicationQuery.refetch()} /> : null}
      {application ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Amount requested" value={<MoneyText kobo={application.principalKobo} />} hint={application.product?.name ?? 'No product'} />
              <StatCard label="Monthly instalment" value={<MoneyText kobo={application.quote.instalmentKobo} />} hint={`${application.termMonths} months at ${application.annualRatePercent}%`} />
              <StatCard label="Total interest" value={<MoneyText kobo={application.quote.totalInterestKobo} />} />
              <StatCard label="Purpose" value={<span className="text-sm leading-snug font-medium">{application.purpose ?? '—'}</span>} />
            </dl>

            {application.status === 'REJECTED' ? (
              <Alert tone="danger" title={`Rejected by ${application.decidedBy?.fullName ?? 'someone'} on ${application.decidedAt?.slice(0, 10) ?? ''}`}>
                {application.rejectionReason}
              </Alert>
            ) : null}
            {application.status === 'APPROVED' && application.loanId ? (
              <Alert tone="success" title={`Approved by ${application.decidedBy?.fullName ?? 'someone'} on ${application.decidedAt?.slice(0, 10) ?? ''}`}>
                Disbursed as{' '}
                <Link className="font-medium underline" to={`/loans/${application.loanId}`}>
                  {application.loanId}
                </Link>
                {application.assignedOfficer ? `, followed up by ${application.assignedOfficer.fullName}` : ''}.
              </Alert>
            ) : null}

            {isOpen(application.status) ? (
              <DecisionPanel
                key={application.assignedOfficer?.userId ?? 'none'}
                application={application}
                isAdmin={isAdmin}
                currentUserName={user.fullName}
                officerOptions={officerOptions}
                isApproving={approve.isPending}
                isRejecting={reject.isPending}
                approveError={approve.error}
                rejectError={reject.error}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ) : null}

            <DashboardLikeCard title="Repayment schedule if approved">
              <AmortisationScheduleTable schedule={application.quote.schedule} />
            </DashboardLikeCard>
          </div>

          <div className="flex flex-col gap-5">
            <DashboardLikeCard title="Applicant" action={<Link className="text-sm font-medium text-brand hover:underline" to={`/customers/${application.customer.customerId}`}>View profile</Link>}>
              <p className="text-base font-semibold text-ink">{application.customer.fullName}</p>
              <p className="mt-1 text-sm text-ink-muted">{[application.customer.email, application.customer.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
              <p className="mt-3 text-sm text-ink">Customer's officer: <span className="text-ink-muted">{application.customerOfficer?.fullName ?? 'None'}</span></p>
              <Link className="mt-3 inline-block text-sm font-medium text-brand hover:underline" to={`/customers/${application.customer.customerId}?tab=history`}>
                Loan history
              </Link>
            </DashboardLikeCard>

            <DashboardLikeCard
              title="Verification"
              action={<Link className="text-sm font-medium text-brand hover:underline" to={`/customers/${application.customer.customerId}?tab=documents`}>Open documents</Link>}
            >
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Verified', value: application.verification.verified, tone: 'text-success' },
                  { label: 'Waiting for review', value: application.verification.awaitingReview, tone: 'text-orange' },
                  { label: 'Requested', value: application.verification.requested, tone: 'text-info' },
                  { label: 'Rejected', value: application.verification.rejected, tone: 'text-danger' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-canvas px-3 py-2">
                    <dt className="text-xs text-ink-muted">{item.label}</dt>
                    <dd className={`text-lg font-semibold ${item.value > 0 ? item.tone : 'text-ink-muted'}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </DashboardLikeCard>

            <DashboardLikeCard title="Loan officer">
              {isAdmin && isOpen(application.status) ? (
                <SelectField
                  label="Assigned officer"
                  hideLabel
                  options={officerOptions}
                  placeholder="Unassigned"
                  value={application.assignedOfficer?.userId ?? ''}
                  disabled={assignOfficer.isPending}
                  onChange={(event) =>
                    assignOfficer.mutate(event.target.value || null, {
                      onSuccess: (updated) => toast.success(updated.assignedOfficer ? `Assigned to ${updated.assignedOfficer.fullName}` : 'Officer removed'),
                    })
                  }
                />
              ) : (
                <p className="text-sm text-ink">{application.assignedOfficer?.fullName ?? 'Unassigned'}</p>
              )}
              {assignOfficer.error ? <p className="mt-2 text-xs text-danger">{assignOfficer.error.message}</p> : null}
            </DashboardLikeCard>

            <DashboardLikeCard title="History">
              <ol className="flex flex-col gap-2.5">
                <TimelineRow label="Submitted" who={application.channel === 'PORTAL' ? 'The applicant, online' : application.submittedBy?.fullName} when={application.submittedAt} />
                <TimelineRow label="Review started" who={application.reviewedBy?.fullName} when={application.reviewStartedAt} />
                <TimelineRow label={application.status === 'REJECTED' ? 'Rejected' : 'Approved'} who={application.decidedBy?.fullName} when={application.decidedAt} />
              </ol>
            </DashboardLikeCard>
          </div>
        </div>
      ) : null}
    </>
  );
}
