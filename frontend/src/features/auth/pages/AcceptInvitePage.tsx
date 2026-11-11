import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAcceptInvitationMutation, useInvitationQuery } from '../api/authApi';
import { AuthShell } from '../components/AuthShell';
import { homePathFor } from '../components/RequireAuth';
import {
  acceptInvitationFormSchema,
  USER_ROLE_LABELS,
  type AcceptInvitationFormInput,
  type AcceptInvitationValues,
} from '../schemas/auth';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const invitationQuery = useInvitationQuery(token);
  const acceptMutation = useAcceptInvitationMutation(token);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationFormInput, unknown, AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationFormSchema),
    defaultValues: { fullName: '', password: '', confirmPassword: '' },
  });

  const handleAccept = (values: AcceptInvitationValues) => {
    acceptMutation.mutate(values, { onSuccess: ({ user }) => navigate(homePathFor(user.role), { replace: true }) });
  };

  return (
    <AuthShell title="Join BAS Finance" subtitle={invitationQuery.data ? `You were invited as ${USER_ROLE_LABELS[invitationQuery.data.role]} (${invitationQuery.data.email}).` : undefined}>
      {token === '' ? <Alert tone="danger">This invitation link is missing its token.</Alert> : null}
      {invitationQuery.isPending && token !== '' ? <Skeleton className="h-48 w-full" /> : null}
      {invitationQuery.isError ? <QueryError error={invitationQuery.error} /> : null}
      {invitationQuery.isSuccess ? (
        <form noValidate onSubmit={handleSubmit(handleAccept)} className="flex flex-col gap-5">
          <TextField label="Full name" autoComplete="name" isRequired errorMessage={errors.fullName?.message} {...register('fullName')} />
          <PasswordField label="Password" autoComplete="new-password" isRequired hint="At least 8 characters" errorMessage={errors.password?.message} {...register('password')} />
          <PasswordField label="Repeat password" autoComplete="new-password" isRequired errorMessage={errors.confirmPassword?.message} {...register('confirmPassword')} />
          {acceptMutation.error ? <Alert tone="danger">{acceptMutation.error.message}</Alert> : null}
          <Button type="submit" isLoading={acceptMutation.isPending} className="w-full py-2.5">
            Create account
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}
