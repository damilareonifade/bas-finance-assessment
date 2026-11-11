import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import {
  invitationPreviewSchema,
  sessionResponseSchema,
  type AcceptInvitationValues,
  type ChangePasswordValues,
  type LoginRequest,
} from '../schemas/auth';

export const authKeys = {
  session: ['auth', 'session'] as const,
  invitation: (token: string) => ['auth', 'invitation', token] as const,
};

/** The signed-in user. A 401 here means "not signed in" and sends the visitor to /login. */
export function useSessionQuery() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => (await apiRequest({ method: 'GET', path: '/auth/me', responseSchema: sessionResponseSchema })).user,
    staleTime: 5 * 60_000,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: LoginRequest) => apiRequest({ method: 'POST', path: '/auth/login', body: request, responseSchema: sessionResponseSchema }),
    onSuccess: ({ user }) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.session, user);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest({ method: 'POST', path: '/auth/logout', responseSchema: z.null() }),
    onSettled: () => queryClient.clear(),
  });
}

export function useInvitationQuery(token: string) {
  return useQuery({
    queryKey: authKeys.invitation(token),
    queryFn: () => apiRequest({ method: 'GET', path: `/auth/invitations/${encodeURIComponent(token)}`, responseSchema: invitationPreviewSchema }),
    enabled: token.length > 0,
    retry: false,
  });
}

export function useAcceptInvitationMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AcceptInvitationValues) =>
      apiRequest({
        method: 'POST',
        path: '/auth/accept-invitation',
        body: { token, fullName: values.fullName, password: values.password },
        responseSchema: sessionResponseSchema,
      }),
    onSuccess: ({ user }) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.session, user);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordValues) =>
      apiRequest({ method: 'POST', path: '/auth/change-password', body: { currentPassword, newPassword }, responseSchema: z.null() }),
  });
}
