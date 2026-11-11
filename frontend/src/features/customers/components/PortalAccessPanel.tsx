import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { mapServerFieldErrors } from '@/lib/api';
import { useInviteToPortalMutation, usePortalAccessQuery, useSetPortalAccessMutation, type PortalAccess } from '../api/customerApi';

const STATUS: Readonly<Record<PortalAccess['status'], { label: string; tone: StatusTone }>> = {
  NONE: { label: 'Not invited', tone: 'neutral' },
  INVITED: { label: 'Invited', tone: 'waiting' },
  ACTIVE: { label: 'Active', tone: 'good' },
  DISABLED: { label: 'Switched off', tone: 'alert' },
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

interface PortalAccessPanelProps {
  readonly customerId: string;
  readonly customerEmail: string | null;
  readonly isAdmin: boolean;
}

/** Staff invite the customer to the self-service portal and see whether they use it. */
export function PortalAccessPanel({ customerId, customerEmail, isAdmin }: PortalAccessPanelProps) {
  const toast = useToast();
  const accessQuery = usePortalAccessQuery(customerId);
  const inviteMutation = useInviteToPortalMutation(customerId);
  const statusMutation = useSetPortalAccessMutation(customerId);
  const [email, setEmail] = useState(customerEmail ?? '');
  const access = accessQuery.data;
  const emailError = inviteMutation.error ? mapServerFieldErrors(inviteMutation.error, { email: 'email' }).mapped[0]?.message : undefined;

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy — select the link and copy it by hand');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Customer portal"
        description="Lets the customer sign in at /portal to see their loans, apply and upload documents."
        action={access ? <StatusChip tone={STATUS[access.status].tone}>{STATUS[access.status].label}</StatusChip> : null}
      />
      {accessQuery.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {accessQuery.isError ? <QueryError error={accessQuery.error} onRetry={() => void accessQuery.refetch()} /> : null}
      {access ? (
        <div className="flex flex-col gap-4">
          {access.status === 'ACTIVE' || access.status === 'DISABLED' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                Signs in with <span className="font-medium">{access.email}</span>
                {access.lastLoginAt ? ` · last signed in ${day(access.lastLoginAt)}` : ' · has not signed in yet'}
              </p>
              {isAdmin ? (
                <Button
                  variant="secondary"
                  isLoading={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate(access.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', {
                      onSuccess: (updated) => toast.success(updated.status === 'ACTIVE' ? 'Portal sign-in switched back on' : 'Portal sign-in switched off'),
                    })
                  }
                >
                  {access.status === 'ACTIVE' ? 'Switch off sign-in' : 'Switch sign-in back on'}
                </Button>
              ) : null}
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                inviteMutation.mutate(email.trim() || undefined);
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <TextField
                  label="Customer’s email"
                  type="email"
                  hint={access.status === 'INVITED' ? `Invited ${access.email ?? ''} — link valid until ${day(access.invitationExpiresAt)}. A new link replaces the old one.` : 'They will sign in with this email.'}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  errorMessage={emailError}
                />
              </div>
              <Button type="submit" isLoading={inviteMutation.isPending}>
                {access.status === 'INVITED' ? 'Create a new link' : 'Invite to portal'}
              </Button>
            </form>
          )}
          {inviteMutation.error && !emailError ? <Alert tone="danger">{inviteMutation.error.message}</Alert> : null}
          {inviteMutation.data ? (
            <Alert tone="success" title="Share this link with the customer">
              <span className="block break-all font-mono text-xs">{inviteMutation.data.inviteLink}</span>
              <span className="mt-2 flex gap-3">
                <button type="button" onClick={() => void copyLink(inviteMutation.data.inviteLink)} className="text-sm font-medium text-brand hover:underline">
                  Copy link
                </button>
                <span className="text-xs text-ink-muted">It works once and expires in 7 days. No email is sent automatically.</span>
              </span>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
