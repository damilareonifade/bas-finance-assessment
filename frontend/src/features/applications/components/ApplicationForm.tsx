import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { FormActions } from '@/components/layout/FormActions';
import { FormSection } from '@/components/layout/FormSection';
import { useSubmitIntent, type SubmitIntent } from '@/components/layout/submitIntent';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { APPLICATION_SERVER_FIELD_MAP, applicationFormSchema, type ApplicationFormInput, type ApplicationRequest } from '../schemas/application';

interface ApplicationFormProps {
  readonly customerOptions: readonly SelectOption[];
  readonly productOptions: readonly SelectOption[];
  readonly defaultCustomerId?: string;
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly cancelTo: string;
  readonly onSubmit: (request: ApplicationRequest, intent: SubmitIntent, resetForm: () => void) => void;
}

export function ApplicationForm({ customerOptions, productOptions, defaultCustomerId = '', isSubmitting, serverError, cancelTo, onSubmit }: ApplicationFormProps) {
  const intent = useSubmitIntent();
  const emptyForm: ApplicationFormInput = { customerIdInput: defaultCustomerId, loanProductIdInput: '', principalInput: '', annualRatePercentInput: '', termMonthsInput: '', purposeInput: '' };
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<ApplicationFormInput, unknown, ApplicationRequest>({ resolver: zodResolver(applicationFormSchema), defaultValues: emptyForm });

  // Applicants load after first render: select the pre-chosen one once its option exists, without wiping typed input.
  useEffect(() => {
    if (defaultCustomerId && customerOptions.some((option) => option.value === defaultCustomerId) && getValues('customerIdInput') === defaultCustomerId) {
      setValue('customerIdInput', defaultCustomerId);
    }
  }, [customerOptions, defaultCustomerId, getValues, setValue]);

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, APPLICATION_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [serverError, setError]);
  const hasUnmappedError = useMemo(() => serverError !== null && mapServerFieldErrors(serverError, APPLICATION_SERVER_FIELD_MAP).mapped.length === 0, [serverError]);

  const resetForm = () => {
    reset({ ...emptyForm, customerIdInput: '' });
    setFocus('customerIdInput');
  };

  return (
    <form noValidate onSubmit={handleSubmit((request) => onSubmit(request, intent.current(), resetForm))} className="flex flex-col gap-6">
      <FormSection title="Applicant" description="Who is asking for the loan. Their documents and loan history live on their profile.">
        <SelectField label="Applicant" options={customerOptions} placeholder="Choose a customer" isRequired errorMessage={errors.customerIdInput?.message} {...register('customerIdInput')} />
        <p className="self-end pb-3 text-sm text-ink-muted">
          Not a customer yet?{' '}
          <Link className="font-medium text-brand hover:underline" to="/customers/create">
            Add them first
          </Link>
          .
        </p>
      </FormSection>
      <FormSection title="What they are asking for" description="Monthly reducing balance with equal instalments. The terms are checked against the product, if you pick one.">
        <SelectField label="Loan product" options={productOptions} placeholder="No product" errorMessage={errors.loanProductIdInput?.message} {...register('loanProductIdInput')} />
        <TextField label="Amount requested (₦)" inputMode="decimal" placeholder="1,200,000" isRequired errorMessage={errors.principalInput?.message} {...register('principalInput')} />
        <TextField label="Annual interest rate (%)" inputMode="decimal" placeholder="18" isRequired errorMessage={errors.annualRatePercentInput?.message} {...register('annualRatePercentInput')} />
        <TextField label="Term (months)" inputMode="numeric" placeholder="6" isRequired errorMessage={errors.termMonthsInput?.message} {...register('termMonthsInput')} />
        <div className="sm:col-span-2">
          <TextField label="Purpose" hint="Optional — what the money is for" errorMessage={errors.purposeInput?.message} {...register('purposeInput')} />
        </div>
      </FormSection>
      {hasUnmappedError && serverError ? <Alert tone="danger">{serverError.message}</Alert> : null}
      <FormActions cancelTo={cancelTo}>
        <Button type="submit" isLoading={isSubmitting} onClick={intent.markAs('create')}>
          Submit application
        </Button>
        <Button type="submit" variant="secondary" disabled={isSubmitting} onClick={intent.markAs('create-another')}>
          Submit &amp; add another
        </Button>
      </FormActions>
    </form>
  );
}
