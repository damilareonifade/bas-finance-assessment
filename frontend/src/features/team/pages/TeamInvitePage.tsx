import { PageHeader } from '@/components/layout/PageHeader';
import { InviteMemberForm } from '../components/InviteMemberForm';

export default function TeamInvitePage() {
  return (
    <>
      <PageHeader title="Invite a team member" breadcrumbs={[{ label: 'Team', to: '/team' }, { label: 'Invite' }]} />
      <InviteMemberForm />
    </>
  );
}
