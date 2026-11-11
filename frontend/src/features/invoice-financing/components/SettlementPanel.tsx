import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { formatKobo } from '@/lib/money';
import { mapServerFieldErrors } from '@/lib/api';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { createIdempotencyKey } from '@/lib/utils/idempotencyKey';
import { usePreviewSettlementMutation, useSettleInvoiceMutation } from '../api/invoiceApi';
import {
  SETTLEMENT_SERVER_FIELD_MAP,
  settlementFormSchema,
  type SettlementFormInput,
  type SettlementRequest,
} from '../schemas/invoice';
import { SettlementOutcome } from './SettlementOutcome';

interface SettlementPanelProps {
  readonly invoiceId: string;
}

export function SettlementPanel({ invoiceId }: SettlementPanelProps) {
  const toast = useToast();
  const previewMutation = usePreviewSettlementMutation(invoiceId);
  const settleMutation = useSettleInvoiceMutation(invoiceId);
  const [previewedRequest, setPreviewedRequest] = useState<SettlementRequest | null>(null);
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const {
    register,
    handleSubmit,
    setError,
    subscribe,
    formState: { errors },
  } = useForm<SettlementFormInput, unknown, SettlementRequest>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: { settlementDateInput: todayCalendarDate() },
  });

  const { reset: resetPreview } = previewMutation;
  const { reset: resetSettle } = settleMutation;

  useEffect(() => {
    return subscribe({
      formState: { values: true },
      callback: () => {
        setPreviewedRequest(null);
        resetPreview();
        idempotencyKeyRef.current = createIdempotencyKey();
      },
    });
  }, [subscribe, resetPreview]);

  useEffect(() => {
    if (!previewMutation.error) return;
    mapServerFieldErrors(previewMutation.error, SETTLEMENT_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) =>
      setError(field, { type: 'server', message }),
    );
  }, [previewMutation.error, setError]);

  const handlePreview = useCallback(
    (request: SettlementRequest) => {
      resetSettle();
      setPreviewedRequest(request);
      previewMutation.mutate(request);
    },
    [previewMutation, resetSettle],
  );

  const handleConfirm = useCallback(() => {
    if (!previewedRequest || settleMutation.isPending || settleMutation.isSuccess) return;
    settleMutation.mutate(
      { request: previewedRequest, idempotencyKey: idempotencyKeyRef.current },
      {
        onSuccess: (settlement) =>
          toast.success(
            'Invoice settled',
            settlement.clientOwesKobo > 0 ? `The client owes a shortfall of ${formatKobo(settlement.clientOwesKobo)}.` : `${formatKobo(settlement.clientReceivesKobo)} is payable to the client.`,
          ),
      },
    );
  }, [previewedRequest, settleMutation, toast]);

  const settlement = settleMutation.data ?? (previewedRequest ? previewMutation.data : undefined);
  const showGenericPreviewError = previewMutation.error && previewMutation.error.name !== 'ApiValidationError';

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Settle invoice" description="The debtor pays the lender the full face value." />
        <form noValidate onSubmit={handleSubmit(handlePreview)} className="flex flex-wrap items-end gap-4">
          <TextField label="Date the debtor paid" type="date" errorMessage={errors.settlementDateInput?.message} {...register('settlementDateInput')} />
          <Button type="submit" variant="secondary" isLoading={previewMutation.isPending}>Preview settlement</Button>
        </form>
      </Card>
      {showGenericPreviewError ? <Alert tone="danger" title="Could not preview settlement">{previewMutation.error?.message}</Alert> : null}
      {settleMutation.error ? <Alert tone="danger" title="Settlement was not posted">{settleMutation.error.message}</Alert> : null}
      {settlement ? (
        <SettlementOutcome
          settlement={settlement}
          isPosted={settleMutation.isSuccess}
          isConfirming={settleMutation.isPending}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}
