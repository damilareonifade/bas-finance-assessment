import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormActions } from '@/components/layout/FormActions';
import { FormSection } from '@/components/layout/FormSection';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { USER_ROLE_LABELS } from '@/features/auth';
import { mapServerFieldErrors } from '@/lib/api';
import { useInviteMemberMutation } from '../api/teamApi';
import { INVITE_SERVER_FIELD_MAP, inviteFormSchema, type InviteFormInput, type InviteRequest } from '../schemas/team';

const ROLE_OPTIONS = [
  { value: 'LOAN_OFFICER', label: USER_ROLE_LABELS.LOAN_OFFICER },
  { value: 'ADMIN', label: USER_ROLE_LABELS.ADMIN },
] as const;

/** Invite form → one-time link. No email is sent from this app, so the link is shown here to share. */
export function InviteMemberForm() {
  const toast = useToast();
  const inviteMutation = useInviteMemberMutation();
  const [hasCopied, setHasCopied] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InviteFormInput, unknown, InviteRequest>({ resolver: zodResolver(inviteFormSchema), defaultValues: { email: '', role: 'LOAN_OFFICER' } });

  useEffect(() => {
    if (!inviteMutation.error) return;
    mapServerFieldErrors(inviteMutation.error, INVITE_SERVER_FIELD_MAP).mapped.forEach(({ field, message }) => setError(field, { type: 'server', message }));
  }, [inviteMutation.error, setError]);

  const handleInvite = (request: InviteRequest) => {
    setHasCopied(false);
    inviteMutation.mutate(request, {
      onSuccess: ({ invitation }) => {
        toast.success('Invitation created', invitation.email);
        reset({ email: '', role: request.role });
      },
    });
  };

  const handleCopy = async (inviteLink: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setHasCopied(true);
    } catch {
      setHasCopied(false);
    }
  };

  const createdInvitation = inviteMutation.data;
  const isServerFieldError = inviteMutation.error?.name === 'ApiValidationError';

  return (
    <div className="flex flex-col gap-6">
      {createdInvitation ? (
        <Alert tone="success" title={`Share this link with ${createdInvitation.invitation.email}`}>
          <p className="mb-3">No email is sent from this app. The link is shown only once and expires in 7 days.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="Invitation link" value={createdInvitation.inviteLink} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-xs text-ink" />
            <Button variant="secondary" onClick={() => void handleCopy(createdInvitation.inviteLink)}>
              {hasCopied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </Alert>
      ) : null}

      <form noValidate onSubmit={handleSubmit(handleInvite)} className="flex flex-col gap-6">
        <FormSection title="Who are you inviting?" description="They choose their own name and password when they accept.">
          <TextField label="Email" type="email" isRequired errorMessage={errors.email?.message} {...register('email')} />
          <SelectField label="Role" options={ROLE_OPTIONS} errorMessage={errors.role?.message} {...register('role')} />
        </FormSection>
        {inviteMutation.error && !isServerFieldError ? <Alert tone="danger">{inviteMutation.error.message}</Alert> : null}
        <FormActions cancelTo="/team">
          <Button type="submit" isLoading={inviteMutation.isPending}>
            {createdInvitation ? 'Invite another' : 'Send invite'}
          </Button>
          {createdInvitation ? (
            <ButtonLink variant="secondary" to="/team?tab=invitations">
              Done
            </ButtonLink>
          ) : null}
        </FormActions>
      </form>
    </div>
  );
}
