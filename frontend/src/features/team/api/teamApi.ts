import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { createdInvitationSchema, invitationSchema, teamMemberSchema, type InviteRequest } from '../schemas/team';

export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  invitations: () => [...teamKeys.all, 'invitations'] as const,
};

export function useTeamMembersQuery(isEnabled = true) {
  return useQuery({ queryKey: teamKeys.members(), enabled: isEnabled, queryFn: () => apiRequest({ method: 'GET', path: '/team/members', responseSchema: z.array(teamMemberSchema) }) });
}

export function useInvitationsQuery() {
  return useQuery({ queryKey: teamKeys.invitations(), queryFn: () => apiRequest({ method: 'GET', path: '/team/invitations', responseSchema: z.array(invitationSchema) }) });
}

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: InviteRequest) => apiRequest({ method: 'POST', path: '/team/invitations', body: request, responseSchema: createdInvitationSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.invitations() }),
  });
}

export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiRequest({ method: 'DELETE', path: `/team/invitations/${encodeURIComponent(invitationId)}`, responseSchema: invitationSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.invitations() }),
  });
}

interface SetMemberStatusVariables {
  readonly userId: string;
  readonly status: 'ACTIVE' | 'DISABLED';
}

export function useSetMemberStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: SetMemberStatusVariables) =>
      apiRequest({ method: 'PATCH', path: `/team/members/${encodeURIComponent(userId)}/status`, body: { status }, responseSchema: teamMemberSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.members() }),
  });
}
