import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { notificationKeys } from '@/features/notifications';
import { apiRequest } from '@/lib/api';
import { applicationDetailSchema, applicationSchema, approvedApplicationSchema, type ApplicationRequest, type ApplicationStatus } from '../schemas/application';

export interface ApplicationFilters {
  readonly status?: ApplicationStatus | 'OPEN';
  /** User id or "me". */
  readonly officerId?: string;
  /** User id or "me". */
  readonly decidedBy?: string;
  readonly customerId?: string;
  readonly search?: string;
}

export const applicationKeys = {
  all: ['loan-applications'] as const,
  list: (filters: ApplicationFilters) => [...applicationKeys.all, 'list', filters] as const,
  detail: (applicationId: string) => [...applicationKeys.all, 'detail', applicationId] as const,
};

function toQueryString(filters: ApplicationFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useApplicationsQuery(filters: ApplicationFilters = {}) {
  return useQuery({
    queryKey: applicationKeys.list(filters),
    queryFn: () => apiRequest({ method: 'GET', path: `/loan-applications${toQueryString(filters)}`, responseSchema: z.array(applicationSchema) }),
  });
}

export function useApplicationQuery(applicationId: string) {
  return useQuery({
    queryKey: applicationKeys.detail(applicationId),
    queryFn: () => apiRequest({ method: 'GET', path: `/loan-applications/${encodeURIComponent(applicationId)}`, responseSchema: applicationDetailSchema }),
  });
}

/** Every change to an application can create notifications for the current user's team, so the bell refreshes too. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: applicationKeys.all }), queryClient.invalidateQueries({ queryKey: notificationKeys.inbox })]);
}

export function useSubmitApplicationMutation() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (request: ApplicationRequest) => apiRequest({ method: 'POST', path: '/loan-applications', body: request, responseSchema: applicationDetailSchema }),
    onSuccess: refresh,
  });
}

export function useStartReviewMutation(applicationId: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: () => apiRequest({ method: 'POST', path: `/loan-applications/${encodeURIComponent(applicationId)}/review`, responseSchema: applicationDetailSchema }),
    onSuccess: refresh,
  });
}

export function useAssignApplicationOfficerMutation(applicationId: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (officerId: string | null) =>
      apiRequest({ method: 'PATCH', path: `/loan-applications/${encodeURIComponent(applicationId)}/assignment`, body: { officerId }, responseSchema: applicationDetailSchema }),
    onSuccess: refresh,
  });
}

interface ApproveVariables {
  readonly officerId?: string;
  readonly disbursedOn?: string;
  readonly idempotencyKey: string;
}

export function useApproveApplicationMutation(applicationId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: ({ officerId, disbursedOn, idempotencyKey }: ApproveVariables) =>
      apiRequest({
        method: 'POST',
        path: `/loan-applications/${encodeURIComponent(applicationId)}/approve`,
        body: { officerId, disbursedOn },
        idempotencyKey,
        responseSchema: approvedApplicationSchema,
      }),
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['term-loans'] }), queryClient.invalidateQueries({ queryKey: ['customers'] })]);
    },
  });
}

export function useRejectApplicationMutation(applicationId: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: (reason: string) =>
      apiRequest({ method: 'POST', path: `/loan-applications/${encodeURIComponent(applicationId)}/reject`, body: { reason }, responseSchema: applicationDetailSchema }),
    onSuccess: refresh,
  });
}
