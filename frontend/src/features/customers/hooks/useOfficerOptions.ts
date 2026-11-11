import { useMemo } from 'react';
import type { SelectOption } from '@/components/ui/SelectField';
import { useTeamMembersQuery } from '@/features/team';

/** Active loan officers as select options (admins only — the endpoint is admin-only). */
export function useOfficerOptions(isEnabled: boolean): readonly SelectOption[] {
  const membersQuery = useTeamMembersQuery(isEnabled);
  return useMemo(
    () => (membersQuery.data ?? []).filter((member) => member.role === 'LOAN_OFFICER' && member.status === 'ACTIVE').map((member) => ({ value: member.userId, label: member.fullName })),
    [membersQuery.data],
  );
}
