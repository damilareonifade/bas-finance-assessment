import { useCallback, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Card, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { formatKobo } from '@/lib/money';
import { JournalEntryCard } from '@/features/ledger';
import { createIdempotencyKey } from '@/lib/utils/idempotencyKey';
import { useConfirmRepaymentMutation, usePreviewRepaymentMutation } from '../api/repaymentApi';
import type { RepaymentRequest } from '../schemas/repayment';
import { AllocationPreview } from './AllocationPreview';
import { RepaymentForm } from './RepaymentForm';

interface RepaymentPanelProps {
  readonly loanId: string;
}

/** Enter payment → server allocation preview → confirm (idempotent). */
export function RepaymentPanel({ loanId }: RepaymentPanelProps) {
  const toast = useToast();
  const previewMutation = usePreviewRepaymentMutation(loanId);
  const confirmMutation = useConfirmRepaymentMutation(loanId);
  const [previewedRequest, setPreviewedRequest] = useState<RepaymentRequest | null>(null);
  // One key per previewed payment: a double click or retry re-sends the same key and cannot post twice.
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());

  const { reset: resetPreview } = previewMutation;
  const { reset: resetConfirm } = confirmMutation;

  const handlePreviewRequested = useCallback(
    (request: RepaymentRequest) => {
      resetConfirm();
      idempotencyKeyRef.current = createIdempotencyKey();
      setPreviewedRequest(request);
      previewMutation.mutate(request);
    },
    [previewMutation, resetConfirm],
  );

  const handleInputChanged = useCallback(() => {
    // Editing the form makes the previous preview stale, so drop it and rotate the key.
    setPreviewedRequest(null);
    resetPreview();
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [resetPreview]);

  const handleConfirm = useCallback(() => {
    if (!previewedRequest || confirmMutation.isPending) return;
    confirmMutation.mutate(
      { request: previewedRequest, idempotencyKey: idempotencyKeyRef.current },
      { onSuccess: ({ allocation }) => toast.success('Repayment posted', `${formatKobo(allocation.receivedKobo)} applied. Schedule and statement are up to date.`) },
    );
  }, [previewedRequest, confirmMutation, toast]);

  const confirmed = confirmMutation.data;

  return (
    <Card>
      <CardHeader title="Take a repayment" description="The server computes how the payment is allocated." />
      <div className="flex flex-col gap-5">
        <RepaymentForm
          isSubmitting={previewMutation.isPending}
          serverError={previewMutation.error}
          onPreviewRequested={handlePreviewRequested}
          onInputChanged={handleInputChanged}
        />
        {previewMutation.error && previewMutation.error.name !== 'ApiValidationError' ? (
          <Alert tone="danger" title="Could not preview this payment">{previewMutation.error.message}</Alert>
        ) : null}
        {previewMutation.data && previewedRequest ? (
          <AllocationPreview allocation={previewMutation.data} isConfirming={confirmMutation.isPending} onConfirm={handleConfirm} />
        ) : null}
        {confirmMutation.error ? <Alert tone="danger" title="Repayment was not posted">{confirmMutation.error.message}</Alert> : null}
        {confirmed ? (
          <>
            <Alert tone="success" title="Repayment posted">Schedule and statement have been refreshed from the server.</Alert>
            <JournalEntryCard journalEntry={confirmed.journalEntry} title="Payment journal entry" />
          </>
        ) : null}
      </div>
    </Card>
  );
}
