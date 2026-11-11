import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/layout/Tabs';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { UserPlusIcon } from '@/components/ui/icons';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/features/auth';
import { useInvitationsQuery, useRevokeInvitationMutation, useSetMemberStatusMutation, useTeamMembersQuery } from '../api/teamApi';
import { InvitationsTable } from '../components/InvitationsTable';
import { MembersTable } from '../components/MembersTable';

/** Team list: Members and Invitations as tabs (?tab=invitations), invite from the header. */
export default function TeamPage() {
  const currentUser = useCurrentUser();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'members';
  const membersQuery = useTeamMembersQuery();
  const invitationsQuery = useInvitationsQuery();
  const setStatusMutation = useSetMemberStatusMutation();
  const revokeMutation = useRevokeInvitationMutation();
  const pendingCount = invitationsQuery.data?.filter((invitation) => invitation.status === 'PENDING').length ?? 0;

  return (
    <>
      <PageHeader
        title="Team"
        breadcrumbs={[{ label: 'Team' }]}
        description="Loan officers and administrators, and who can sign in."
        actions={
          <ButtonLink to="/team/invite">
            <UserPlusIcon size={18} />
            Invite member
          </ButtonLink>
        }
      />
      <Tabs
        label="Team sections"
        activeId={tab}
        tabs={[
          { id: 'members', to: '/team', label: 'Members' },
          { id: 'invitations', to: '/team?tab=invitations', label: pendingCount > 0 ? `Invitations (${pendingCount} pending)` : 'Invitations' },
        ]}
      />
      <section className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
        {tab === 'members' ? (
          <>
            {membersQuery.isPending ? <TableSkeleton columnCount={5} rowCount={3} /> : null}
            {membersQuery.isError ? <QueryError error={membersQuery.error} onRetry={() => void membersQuery.refetch()} /> : null}
            {setStatusMutation.error ? <Alert tone="danger">{setStatusMutation.error.message}</Alert> : null}
            {membersQuery.isSuccess ? (
              <MembersTable
                members={membersQuery.data}
                currentUserId={currentUser.userId}
                pendingUserId={setStatusMutation.isPending ? (setStatusMutation.variables?.userId ?? null) : null}
                onSetStatus={(userId, status) =>
                  setStatusMutation.mutate({ userId, status }, { onSuccess: (member) => toast.success(member.status === 'ACTIVE' ? 'Account enabled' : 'Account disabled', member.fullName) })
                }
              />
            ) : null}
          </>
        ) : (
          <>
            {invitationsQuery.isPending ? <TableSkeleton columnCount={5} rowCount={3} /> : null}
            {invitationsQuery.isError ? <QueryError error={invitationsQuery.error} onRetry={() => void invitationsQuery.refetch()} /> : null}
            {revokeMutation.error ? <Alert tone="danger">{revokeMutation.error.message}</Alert> : null}
            {invitationsQuery.isSuccess ? (
              <InvitationsTable
                invitations={invitationsQuery.data}
                pendingInvitationId={revokeMutation.isPending ? (revokeMutation.variables ?? null) : null}
                onRevoke={(invitationId) => revokeMutation.mutate(invitationId, { onSuccess: (invitation) => toast.success('Invitation revoked', invitation.email) })}
              />
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
