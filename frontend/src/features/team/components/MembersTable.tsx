import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { USER_ROLE_LABELS } from '@/features/auth';
import type { TeamMember } from '../schemas/team';

interface MembersTableProps {
  readonly members: readonly TeamMember[];
  readonly currentUserId: string;
  readonly pendingUserId: string | null;
  readonly onSetStatus: (userId: string, status: 'ACTIVE' | 'DISABLED') => void;
}

export function MembersTable({ members, currentUserId, pendingUserId, onSetStatus }: MembersTableProps) {
  const columns: ReadonlyArray<DataTableColumn<TeamMember>> = [
    { key: 'name', header: 'Name', render: (member) => member.fullName },
    { key: 'email', header: 'Email', render: (member) => member.email },
    { key: 'role', header: 'Role', render: (member) => USER_ROLE_LABELS[member.role] },
    { key: 'status', header: 'Status', render: (member) => <Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status === 'ACTIVE' ? 'Active' : 'Disabled'}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (member) =>
        member.userId === currentUserId ? (
          <span className="text-xs text-ink-muted">You</span>
        ) : (
          <Button
            variant="secondary"
            isLoading={pendingUserId === member.userId}
            onClick={() => onSetStatus(member.userId, member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}
          >
            {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
          </Button>
        ),
    },
  ];
  return <DataTable caption="Team members" columns={columns} rows={members} getRowKey={(member) => member.userId} />;
}
