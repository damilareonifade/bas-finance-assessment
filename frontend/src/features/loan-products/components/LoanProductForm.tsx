import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormActions } from '@/components/layout/FormActions';
import { FormSection } from '@/components/layout/FormSection';
import { useSubmitIntent, type SubmitIntent } from '@/components/layout/submitIntent';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import {
  loanProductFormSchema,
  PRODUCT_SERVER_FIELD_MAP,
  PRODUCT_TYPE_LABELS,
  type LoanProductFormInput,
  type LoanProductRequest,
} from '../schemas/loanProduct';
import { InvoiceFinancingTermsNote } from './InvoiceFinancingTermsNote';

interface LoanProductFormProps {
  /** "create" shows Create / Create & create another; "edit" shows Save changes and locks the type. */
  readonly mode: 'create' | 'edit';
  readonly defaultValues?: LoanProductFormInput;
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly cancelTo: string;
  readonly onSubmit: (request: LoanProductRequest, intent: SubmitIntent, resetForm: () => void) => void;
}

const TYPE_OPTIONS = [
  { value: 'TERM_LOAN', label: PRODUCT_TYPE_LABELS.TERM_LOAN },
  { value: 'INVOICE_FINANCING', label: PRODUCT_TYPE_LABELS.INVOICE_FINANCING },
] as const;

export const EMPTY_PRODUCT_FORM: LoanProductFormInput = {
  name: '',
  type: 'TERM_LOAN',
  description: '',
  minPrincipalInput: '',
  maxPrincipalInput: '',
  minRateInput: '',
  maxRateInput: '',
  minTermInput: '',
  maxTermInput: '',
};

export function LoanProductForm({ mode, defaultValues = EMPTY_PRODUCT_FORM, isSubmitting, serverError, cancelTo, onSubmit }: LoanProductFormProps) {
  const intent = useSubmitIntent();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setFocus,
    control,
    formState: { errors },
  } = useForm<LoanProductFormInput, unknown, LoanProductRequest>({ resolver: zodResolver(loanProductFormSchema), defaultValues });
  const selectedType = useWatch({ control, name: 'type' });
  const isInvoiceFinancing = selectedType === 'INVOICE_FINANCING';

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, PRODUCT_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [serverError, setError]);

  const hasUnmappedError = serverError !== null && mapServerFieldErrors(serverError, PRODUCT_SERVER_FIELD_MAP).mapped.length === 0;
  const resetForm = () => {
    reset(EMPTY_PRODUCT_FORM);
    setFocus('name');
  };

  return (
    <form noValidate onSubmit={handleSubmit((request) => onSubmit(request, intent.current(), resetForm))} className="flex flex-col gap-6">
      <FormSection title="Product" description="What officers will pick when they write a facility.">
        <TextField label="Name" isRequired errorMessage={errors.name?.message} {...register('name')} />
        <SelectField
          label="Type"
          options={TYPE_OPTIONS}
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? 'The type cannot change once a product exists.' : undefined}
          errorMessage={errors.type?.message}
          {...register('type')}
        />
        <div className="sm:col-span-2">
          <TextField label="Description" hint="Optional" errorMessage={errors.description?.message} {...register('description')} />
        </div>
      </FormSection>

      <FormSection title="Limits" description="Enforced on every loan or invoice written under this product. Leave a limit blank to use the default.">
        {isInvoiceFinancing ? (
          <div className="sm:col-span-2">
            <InvoiceFinancingTermsNote />
          </div>
        ) : null}
        <TextField
          label={isInvoiceFinancing ? 'Minimum invoice face value (₦)' : 'Minimum amount (₦)'}
          inputMode="decimal"
          errorMessage={errors.minPrincipalInput?.message}
          {...register('minPrincipalInput')}
        />
        <TextField
          label={isInvoiceFinancing ? 'Maximum invoice face value (₦)' : 'Maximum amount (₦)'}
          inputMode="decimal"
          errorMessage={errors.maxPrincipalInput?.message}
          {...register('maxPrincipalInput')}
        />
        {selectedType === 'TERM_LOAN' ? (
          <>
            <TextField label="Minimum annual rate (%)" inputMode="decimal" errorMessage={errors.minRateInput?.message} {...register('minRateInput')} />
            <TextField label="Maximum annual rate (%)" inputMode="decimal" errorMessage={errors.maxRateInput?.message} {...register('maxRateInput')} />
            <TextField label="Minimum term (months)" inputMode="numeric" errorMessage={errors.minTermInput?.message} {...register('minTermInput')} />
            <TextField label="Maximum term (months)" inputMode="numeric" errorMessage={errors.maxTermInput?.message} {...register('maxTermInput')} />
          </>
        ) : null}
      </FormSection>

      {hasUnmappedError && serverError ? <Alert tone="danger">{serverError.message}</Alert> : null}

      <FormActions cancelTo={cancelTo}>
        {mode === 'create' ? (
          <>
            <Button type="submit" isLoading={isSubmitting} onClick={intent.markAs('create')}>
              Create
            </Button>
            <Button type="submit" variant="secondary" disabled={isSubmitting} onClick={intent.markAs('create-another')}>
              Create &amp; create another
            </Button>
          </>
        ) : (
          <Button type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        )}
      </FormActions>
    </form>
  );
}
