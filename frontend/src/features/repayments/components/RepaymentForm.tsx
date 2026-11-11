import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { FieldErrorSummary } from '@/components/ui/QueryState';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { REPAYMENT_SERVER_FIELD_MAP, repaymentFormSchema, type RepaymentFormInput, type RepaymentRequest } from '../schemas/repayment';

interface RepaymentFormProps {
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly onPreviewRequested: (request: RepaymentRequest) => void;
  /** Fired whenever the user edits a field, so a stale preview can be discarded. */
  readonly onInputChanged: () => void;
}

export function RepaymentForm({ isSubmitting, serverError, onPreviewRequested, onInputChanged }: RepaymentFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    subscribe,
    formState: { errors },
  } = useForm<RepaymentFormInput, unknown, RepaymentRequest>({
    resolver: zodResolver(repaymentFormSchema),
    defaultValues: { amountInput: '', paymentDateInput: todayCalendarDate() },
  });
  const unmappedErrors = useMemo(
    () => (serverError ? mapServerFieldErrors(serverError, REPAYMENT_SERVER_FIELD_MAP).unmapped : []),
    [serverError],
  );

  useEffect(() => {
    return subscribe({ formState: { values: true }, callback: () => onInputChanged() });
  }, [subscribe, onInputChanged]);

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, REPAYMENT_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) =>
      setError(field, { type: 'server', message }),
    );
  }, [serverError, setError]);

  return (
    <form noValidate onSubmit={handleSubmit(onPreviewRequested)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Amount received (₦)" inputMode="decimal" errorMessage={errors.amountInput?.message} {...register('amountInput')} />
      <TextField label="Payment date" type="date" errorMessage={errors.paymentDateInput?.message} {...register('paymentDateInput')} />
      <div className="sm:col-span-2">
        <FieldErrorSummary messages={unmappedErrors} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" isLoading={isSubmitting}>
          Preview allocation
        </Button>
      </div>
    </form>
  );
}
