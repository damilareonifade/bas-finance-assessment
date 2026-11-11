import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PasswordField } from '@/components/ui/PasswordField';
import {
  CHANGE_PASSWORD_SERVER_FIELD_MAP,
  changePasswordFormSchema,
  useChangePasswordMutation,
  type ChangePasswordFormInput,
  type ChangePasswordValues,
} from '@/features/auth';
import { mapServerFieldErrors } from '@/lib/api';

const EMPTY_FORM: ChangePasswordFormInput = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordForm() {
  const changeMutation = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormInput, unknown, ChangePasswordValues>({ resolver: zodResolver(changePasswordFormSchema), defaultValues: EMPTY_FORM });

  useEffect(() => {
    if (!changeMutation.error) return;
    mapServerFieldErrors(changeMutation.error, CHANGE_PASSWORD_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [changeMutation.error, setError]);

  const hasUnmappedError = changeMutation.error !== null && mapServerFieldErrors(changeMutation.error, CHANGE_PASSWORD_SERVER_FIELD_MAP).mapped.length === 0;

  return (
    <Card>
      <CardHeader title="Change password" description="You stay signed in on this device." />
      <form noValidate onSubmit={handleSubmit((values) => changeMutation.mutate(values, { onSuccess: () => reset(EMPTY_FORM) }))} className="flex max-w-md flex-col gap-5">
        <PasswordField label="Current password" autoComplete="current-password" isRequired errorMessage={errors.currentPassword?.message} {...register('currentPassword')} />
        <PasswordField label="New password" autoComplete="new-password" isRequired hint="At least 8 characters" errorMessage={errors.newPassword?.message} {...register('newPassword')} />
        <PasswordField label="Repeat new password" autoComplete="new-password" isRequired errorMessage={errors.confirmPassword?.message} {...register('confirmPassword')} />
        {hasUnmappedError && changeMutation.error ? <Alert tone="danger">{changeMutation.error.message}</Alert> : null}
        {changeMutation.isSuccess ? <Alert tone="success">Password changed.</Alert> : null}
        <div>
          <Button type="submit" isLoading={changeMutation.isPending}>
            Save password
          </Button>
        </div>
      </form>
    </Card>
  );
}
