import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FormActions } from '@/components/layout/FormActions';
import { FormSection } from '@/components/layout/FormSection';
import { useSubmitIntent, type SubmitIntent } from '@/components/layout/submitIntent';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { CUSTOMER_SERVER_FIELD_MAP, customerFormSchema, type CustomerFormInput, type CustomerRequest } from '../schemas/customer';

interface CustomerFormProps {
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  /** Active loan officers. Pass only for administrators — an officer's customers are assigned to them automatically. */
  readonly officerOptions?: readonly SelectOption[];
  readonly cancelTo: string;
  /** `resetForm` clears the fields — used after "Create & create another". */
  readonly onSubmit: (request: CustomerRequest, intent: SubmitIntent, resetForm: () => void) => void;
}

const EMPTY_FORM: CustomerFormInput = { fullName: '', email: '', phone: '', assignedOfficerId: '' };

export function CustomerForm({ isSubmitting, serverError, officerOptions, cancelTo, onSubmit }: CustomerFormProps) {
  const intent = useSubmitIntent();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<CustomerFormInput, unknown, CustomerRequest>({ resolver: zodResolver(customerFormSchema), defaultValues: EMPTY_FORM });

  useEffect(() => {
    if (!serverError) return;
    mapServerFieldErrors(serverError, CUSTOMER_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [serverError, setError]);

  const hasUnmappedError = useMemo(() => serverError !== null && mapServerFieldErrors(serverError, CUSTOMER_SERVER_FIELD_MAP).mapped.length === 0, [serverError]);

  const resetForm = () => {
    reset(EMPTY_FORM);
    setFocus('fullName');
  };

  return (
    <form noValidate onSubmit={handleSubmit((request) => onSubmit(request, intent.current(), resetForm))} className="flex flex-col gap-6">
      <FormSection title="Customer details" description="How the customer is known and reached.">
        <TextField label="Full name" isRequired errorMessage={errors.fullName?.message} {...register('fullName')} />
        <TextField label="Email" type="email" hint="Optional" errorMessage={errors.email?.message} {...register('email')} />
        <TextField label="Phone" type="tel" hint="Optional" errorMessage={errors.phone?.message} {...register('phone')} />
      </FormSection>

      {officerOptions ? (
        <FormSection title="Loan officer" description="The officer who follows this customer up for repayments. You can change it later.">
          <SelectField label="Assigned officer" options={officerOptions} placeholder="Unassigned" errorMessage={errors.assignedOfficerId?.message} {...register('assignedOfficerId')} />
        </FormSection>
      ) : null}

      {hasUnmappedError && serverError ? <Alert tone="danger">{serverError.message}</Alert> : null}

      <FormActions cancelTo={cancelTo}>
        <Button type="submit" isLoading={isSubmitting} onClick={intent.markAs('create')}>
          Create
        </Button>
        <Button type="submit" variant="secondary" disabled={isSubmitting} onClick={intent.markAs('create-another')}>
          Create &amp; create another
        </Button>
      </FormActions>
    </form>
  );
}
