import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { USER_ROLE_LABELS, useCurrentUser } from '@/features/auth';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

export default function SettingsPage() {
  const user = useCurrentUser();
  return (
    <>
      <PageHeader title="Settings" description="Your account on BAS Finance." />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Profile" description="Ask an administrator if any of this needs to change." />
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-muted">Name</dt>
              <dd className="font-medium">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Role</dt>
              <dd className="font-medium">{USER_ROLE_LABELS[user.role]}</dd>
            </div>
          </dl>
        </Card>
        <ChangePasswordForm />
      </div>
    </>
  );
}
