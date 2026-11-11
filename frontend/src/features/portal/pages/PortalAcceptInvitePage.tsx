import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { usePortalAcceptInvitationMutation, usePortalInvitationQuery } from '../api/portalApi';
import { portalSetPasswordFormSchema, type PortalSetPasswordFormInput, type PortalSetPasswordValues } from '../schemas/portal';

/** The link staff share: /portal/accept-invite?token=… — the customer chooses a password and lands in the portal. */
export default function PortalAcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const invitationQuery = usePortalInvitationQuery(token);
  const acceptMutation = usePortalAcceptInvitationMutation(token);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PortalSetPasswordFormInput, unknown, PortalSetPasswordValues>({ resolver: zodResolver(portalSetPasswordFormSchema), defaultValues: { password: '', confirmPassword: '' } });

  return (
    <AuthShell
      title="Set up your account"
      subtitle={invitationQuery.data ? `Welcome, ${invitationQuery.data.fullName}. You will sign in with ${invitationQuery.data.email}.` : undefined}
    >
      {token === '' ? <Alert tone="danger">This link is missing its code. Ask BAS Finance to send it again.</Alert> : null}
      {invitationQuery.isPending && token !== '' ? <Skeleton className="h-40 w-full" /> : null}
      {invitationQuery.isError ? <QueryError error={invitationQuery.error} /> : null}
      {invitationQuery.isSuccess ? (
        <form
          noValidate
          onSubmit={handleSubmit((values) => acceptMutation.mutate(values.password, { onSuccess: () => navigate('/portal', { replace: true }) }))}
          className="flex flex-col gap-5"
        >
          <PasswordField label="Choose a password" autoComplete="new-password" isRequired hint="At least 8 characters" errorMessage={errors.password?.message} {...register('password')} />
          <PasswordField label="Repeat password" autoComplete="new-password" isRequired errorMessage={errors.confirmPassword?.message} {...register('confirmPassword')} />
          {acceptMutation.error ? <Alert tone="danger">{acceptMutation.error.message}</Alert> : null}
          <Button type="submit" isLoading={acceptMutation.isPending} className="w-full py-2.5">
            Create my account
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}
