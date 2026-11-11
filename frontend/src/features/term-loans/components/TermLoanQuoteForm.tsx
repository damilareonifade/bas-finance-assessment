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
import { TERM_LOAN_SERVER_FIELD_MAP, termLoanFormSchema, type TermLoanFormInput, type TermLoanRequest } from '../schemas/termLoan';

interface TermLoanQuoteFormProps {
  readonly isSubmitting: boolean;
  /** Error from the last server call, mapped onto fields. */
  readonly serverError: Error | null;
  readonly onQuoteRequested: (request: TermLoanRequest) => void;
  /** Called on every edit with what the form would submit right now, or null while something is invalid (drives the live quote). */
  readonly onDraftChange?: (request: TermLoanRequest | null) => void;
  readonly customerOptions: readonly SelectOption[];
  readonly productOptions: readonly SelectOption[];
  /** Pre-selected when the page is opened from a customer ("New loan" on the customer page). */
  readonly defaultCustomerId?: string;
  readonly cancelTo?: string;
}

export function TermLoanQuoteForm({
  isSubmitting,
  serverError,
  onQuoteRequested,
  onDraftChange,
  customerOptions,
  productOptions,
  defaultCustomerId = '',
  cancelTo,
}: TermLoanQuoteFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<TermLoanFormInput, unknown, TermLoanRequest>({
    resolver: zodResolver(termLoanFormSchema),
    defaultValues: { principalInput: '', annualRatePercentInput: '', termMonthsInput: '', customerIdInput: defaultCustomerId, loanProductIdInput: '' },
  });
  const watchedValues = useWatch({ control });

  useEffect(() => {
    if (!onDraftChange) return;
    const parsed = termLoanFormSchema.safeParse(watchedValues);
    onDraftChange(parsed.success ? parsed.data : null);
  }, [watchedValues, onDraftChange]);

  const unmappedErrors = useMemo(() => (serverError ? mapServerFieldErrors(serverError, TERM_LOAN_SERVER_FIELD_MAP).unmapped : []), [serverError]);

  // The customer list loads after first render. Once the pre-selected customer's option exists, select it —
  // without remounting the form, so nothing the user already typed is lost.
  useEffect(() => {
    const isAvailable = customerOptions.some((option) => option.value === defaultCustomerId);
    if (defaultCustomerId && isAvailable && getValues('customerIdInput') === defaultCustomerId) setValue('customerIdInput', defaultCustomerId);
  }, [customerOptions, defaultCustomerId, getValues, setValue]);

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, TERM_LOAN_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [serverError, setError]);

  return (
    <form noValidate onSubmit={handleSubmit(onQuoteRequested)} className="flex flex-col gap-6">
      <FormSection title="Borrower" description="Loan officers can only lend to customers assigned to them.">
        <SelectField
          label="Customer"
          options={customerOptions}
          placeholder="No customer (administrators only)"
          errorMessage={errors.customerIdInput?.message}
          {...register('customerIdInput')}
        />
        <SelectField label="Loan product" options={productOptions} placeholder="No product" hint="If chosen, the product's limits apply." errorMessage={errors.loanProductIdInput?.message} {...register('loanProductIdInput')} />
      </FormSection>

      <FormSection title="Terms" description="Monthly reducing balance with equal instalments. The final instalment clears the balance.">
        <TextField label="Principal (₦)" inputMode="decimal" placeholder="1,200,000" isRequired errorMessage={errors.principalInput?.message} {...register('principalInput')} />
        <TextField label="Annual interest rate (%)" inputMode="decimal" placeholder="18" isRequired errorMessage={errors.annualRatePercentInput?.message} {...register('annualRatePercentInput')} />
        <TextField label="Term (months)" inputMode="numeric" placeholder="6" isRequired errorMessage={errors.termMonthsInput?.message} {...register('termMonthsInput')} />
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
