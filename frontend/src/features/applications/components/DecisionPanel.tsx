import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { createIdempotencyKey } from '@/lib/utils/idempotencyKey';
import type { LoanApplicationDetail } from '../schemas/application';
import { DashboardLikeCard } from './DashboardLikeCard';

interface DecisionPanelProps {
  readonly application: LoanApplicationDetail;
  readonly isAdmin: boolean;
  readonly currentUserName: string;
  readonly officerOptions: readonly SelectOption[];
  readonly isApproving: boolean;
  readonly isRejecting: boolean;
  readonly approveError: Error | null;
  readonly rejectError: Error | null;
  readonly onApprove: (input: { officerId?: string; disbursedOn: string; idempotencyKey: string }) => void;
  readonly onReject: (reason: string) => void;
}

/** Approve (assigning the loan officer) or reject. Approving disburses the loan. */
export function DecisionPanel({ application, isAdmin, currentUserName, officerOptions, isApproving, isRejecting, approveError, rejectError, onApprove, onReject }: DecisionPanelProps) {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [officerId, setOfficerId] = useState(application.assignedOfficer?.userId ?? '');
  const [disbursedOn, setDisbursedOn] = useState<string>(todayCalendarDate());
  const [reason, setReason] = useState('');
  // One key per approval attempt: a double click or retry cannot disburse twice.
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const { verification } = application;
  const outstandingChecks = verification.requested + verification.awaitingReview;
  const approveFieldError = (field: string) => (approveError ? mapServerFieldErrors(approveError, { [field]: field }).mapped[0]?.message : undefined);
  const rejectFieldError = rejectError ? mapServerFieldErrors(rejectError, { reason: 'reason' }).mapped[0]?.message : undefined;

  return (
    <DashboardLikeCard title="Decision">
      <div role="tablist" aria-label="Decision" className="mb-5 inline-flex rounded-lg border border-line p-1">
        {(['approve', 'reject'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => setMode(option)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === option ? (option === 'approve' ? 'bg-brand text-surface' : 'bg-danger text-surface') : 'text-ink-muted hover:text-ink'}`}
          >
            {option === 'approve' ? 'Approve' : 'Reject'}
          </button>
        ))}
      </div>

      {mode === 'approve' ? (
        <div className="flex flex-col gap-4">
          {outstandingChecks > 0 || verification.verified === 0 ? (
            <Alert tone="warning" title="Check the applicant's documents first">
              {verification.verified === 0 ? 'No document has been verified yet. ' : ''}
              {outstandingChecks > 0 ? `${outstandingChecks} verification${outstandingChecks === 1 ? ' is' : 's are'} still open.` : ''}
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {isAdmin ? (
              <SelectField
                label="Loan officer for this loan"
                options={officerOptions}
                placeholder="No officer"
                value={officerId}
                onChange={(event) => setOfficerId(event.target.value)}
                hint="They follow the customer up for repayments."
                errorMessage={approveFieldError('assignedOfficerId') ?? approveFieldError('officerId')}
              />
            ) : (
              <div>
                <p className="text-sm font-medium text-ink">Loan officer for this loan</p>
                <p className="mt-2 text-sm text-ink-muted">{currentUserName} (you)</p>
              </div>
            )}
            <TextField label="Disbursement date" type="date" value={disbursedOn} onChange={(event) => setDisbursedOn(event.target.value)} errorMessage={approveFieldError('disbursedOn')} />
          </div>
          {approveError && !approveError.name.includes('Validation') ? <Alert tone="danger">{approveError.message}</Alert> : null}
          <div>
            <Button isLoading={isApproving} onClick={() => onApprove({ officerId: isAdmin ? officerId || undefined : undefined, disbursedOn, idempotencyKey: idempotencyKeyRef.current })}>
              Approve and disburse
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TextField label="Reason" isRequired hint="The submitter and officer will see this." value={reason} onChange={(event) => setReason(event.target.value)} errorMessage={rejectFieldError} />
          {rejectError && !rejectFieldError ? <Alert tone="danger">{rejectError.message}</Alert> : null}
          <div>
            <Button variant="danger" isLoading={isRejecting} onClick={() => onReject(reason)}>
              Reject application
            </Button>
          </div>
        </div>
      )}
    </DashboardLikeCard>
  );
}
