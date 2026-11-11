import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { USER_ROLE_LABELS } from '@/features/auth';
import type { Invitation } from '../schemas/team';

interface InvitationsTableProps {
  readonly invitations: readonly Invitation[];
  readonly pendingInvitationId: string | null;
  readonly onRevoke: (invitationId: string) => void;
}

const STATUS_TONE = { PENDING: 'neutral', ACCEPTED: 'success', REVOKED: 'warning', EXPIRED: 'warning' } as const;

export function InvitationsTable({ invitations, pendingInvitationId, onRevoke }: InvitationsTableProps) {
  const columns: ReadonlyArray<DataTableColumn<Invitation>> = [
    { key: 'email', header: 'Email', render: (invitation) => invitation.email },
    { key: 'role', header: 'Role', render: (invitation) => USER_ROLE_LABELS[invitation.role] },
    { key: 'status', header: 'Status', render: (invitation) => <Badge tone={STATUS_TONE[invitation.status]}>{invitation.status.toLowerCase()}</Badge> },
    { key: 'expires', header: 'Expires', render: (invitation) => invitation.expiresAt.slice(0, 10) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (invitation) =>
        invitation.status === 'PENDING' ? (
          <Button variant="secondary" isLoading={pendingInvitationId === invitation.invitationId} onClick={() => onRevoke(invitation.invitationId)}>
            Revoke
          </Button>
        ) : null,
    },
  ];
  return <DataTable caption="Invitations" columns={columns} rows={invitations} getRowKey={(invitation) => invitation.invitationId} emptyMessage="No invitations yet." />;
}
