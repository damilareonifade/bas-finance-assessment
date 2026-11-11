import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormActions } from '@/components/layout/FormActions';
import { FormSection } from '@/components/layout/FormSection';
import { Button } from '@/components/ui/Button';
import { FieldErrorSummary } from '@/components/ui/QueryState';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { INVOICE_SERVER_FIELD_MAP, invoiceFormSchema, type InvoiceFormInput, type InvoiceRequest } from '../schemas/invoice';

interface InvoiceQuoteFormProps {
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly onQuoteRequested: (request: InvoiceRequest) => void;
  /** Called on every edit with what the form would submit right now, or null while something is invalid (drives the live quote). */
  readonly onDraftChange?: (request: InvoiceRequest | null) => void;
  readonly customerOptions: readonly SelectOption[];
  readonly productOptions: readonly SelectOption[];
  readonly defaultCustomerId?: string;
  readonly cancelTo?: string;
}

export function InvoiceQuoteForm({
  isSubmitting,
  serverError,
  onQuoteRequested,
  onDraftChange,
  customerOptions,
  productOptions,
  defaultCustomerId = '',
  cancelTo,
}: InvoiceQuoteFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, InvoiceRequest>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: { faceValueInput: '', issueDateInput: todayCalendarDate(), dueDateInput: '', customerIdInput: defaultCustomerId, loanProductIdInput: '' },
  });
  const watchedValues = useWatch({ control });

  useEffect(() => {
    if (!onDraftChange) return;
    const parsed = invoiceFormSchema.safeParse(watchedValues);
    onDraftChange(parsed.success ? parsed.data : null);
  }, [watchedValues, onDraftChange]);
  const unmappedErrors = useMemo(() => (serverError ? mapServerFieldErrors(serverError, INVOICE_SERVER_FIELD_MAP).unmapped : []), [serverError]);

  // The customer list loads after first render. Once the pre-selected customer's option exists, select it —
  // without remounting the form, so nothing the user already typed is lost.
  useEffect(() => {
    const isAvailable = customerOptions.some((option) => option.value === defaultCustomerId);
    if (defaultCustomerId && isAvailable && getValues('customerIdInput') === defaultCustomerId) setValue('customerIdInput', defaultCustomerId);
  }, [customerOptions, defaultCustomerId, getValues, setValue]);

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, INVOICE_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [serverError, setError]);

  return (
    <form noValidate onSubmit={handleSubmit(onQuoteRequested)} className="flex flex-col gap-6">
      <FormSection title="Client" description="The business selling the invoice. Loan officers can only finance their assigned customers.">
        <SelectField label="Customer" options={customerOptions} placeholder="No customer (administrators only)" errorMessage={errors.customerIdInput?.message} {...register('customerIdInput')} />
        <SelectField label="Loan product" options={productOptions} placeholder="No product" errorMessage={errors.loanProductIdInput?.message} {...register('loanProductIdInput')} />
      </FormSection>
      <FormSection title="Invoice" description="We advance 80% of the face value now; the debtor pays us in full at maturity.">
        <TextField label="Invoice face value (₦)" inputMode="decimal" placeholder="1,000,000" isRequired errorMessage={errors.faceValueInput?.message} {...register('faceValueInput')} />
        <TextField label="Advance date" type="date" isRequired errorMessage={errors.issueDateInput?.message} {...register('issueDateInput')} />
        <TextField label="Due date" type="date" isRequired errorMessage={errors.dueDateInput?.message} {...register('dueDateInput')} />
      </FormSection>
      <FieldErrorSummary messages={unmappedErrors} />
      <FormActions cancelTo={cancelTo}>
        <Button type="submit" isLoading={isSubmitting}>
          Get quote
        </Button>
      </FormActions>
    </form>
  );
}
