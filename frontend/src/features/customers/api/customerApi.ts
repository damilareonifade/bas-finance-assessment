import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { customerDetailSchema, customerSummarySchema, type CustomerRequest } from '../schemas/customer';

export interface CustomerListFilters {
  readonly search?: string;
  readonly officerId?: string;
  readonly unassignedOnly?: boolean;
}

export const customerKeys = {
  all: ['customers'] as const,
  list: (filters: CustomerListFilters) => [...customerKeys.all, 'list', filters] as const,
  detail: (customerId: string) => [...customerKeys.all, 'detail', customerId] as const,
};

function buildQueryString(filters: CustomerListFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.officerId) params.set('officerId', filters.officerId);
  if (filters.unassignedOnly) params.set('unassigned', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useCustomersQuery(filters: CustomerListFilters = {}) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: () => apiRequest({ method: 'GET', path: `/customers${buildQueryString(filters)}`, responseSchema: z.array(customerSummarySchema) }),
  });
}

export function useCustomerQuery(customerId: string) {
  return useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: () => apiRequest({ method: 'GET', path: `/customers/${encodeURIComponent(customerId)}`, responseSchema: customerDetailSchema }),
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CustomerRequest) => apiRequest({ method: 'POST', path: '/customers', body: request, responseSchema: customerDetailSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

interface AssignOfficerVariables {
  readonly customerId: string;
  /** null un-assigns. */
  readonly officerId: string | null;
}

export function useAssignOfficerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, officerId }: AssignOfficerVariables) =>
      apiRequest({ method: 'PATCH', path: `/customers/${encodeURIComponent(customerId)}/assignment`, body: { officerId }, responseSchema: customerDetailSchema }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/* ---------- Customer portal access (staff side) ---------- */

export const portalAccessSchema = z.object({
  status: z.enum(['NONE', 'INVITED', 'ACTIVE', 'DISABLED']),
  email: z.string().nullable(),
  invitationExpiresAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});
export type PortalAccess = z.infer<typeof portalAccessSchema>;

const portalInvitationResultSchema = z.object({ access: portalAccessSchema, inviteLink: z.string().url() });

const portalAccessKey = (customerId: string) => [...customerKeys.detail(customerId), 'portal-access'] as const;

export function usePortalAccessQuery(customerId: string) {
  return useQuery({
    queryKey: portalAccessKey(customerId),
    queryFn: () => apiRequest({ method: 'GET', path: `/customers/${encodeURIComponent(customerId)}/portal-access`, responseSchema: portalAccessSchema }),
  });
}

export function useInviteToPortalMutation(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string | undefined) =>
      apiRequest({ method: 'POST', path: `/customers/${encodeURIComponent(customerId)}/portal-access/invitation`, body: email ? { email } : {}, responseSchema: portalInvitationResultSchema }),
    onSuccess: ({ access }) => queryClient.setQueryData(portalAccessKey(customerId), access),
  });
}

export function useSetPortalAccessMutation(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: 'ACTIVE' | 'DISABLED') =>
      apiRequest({ method: 'PATCH', path: `/customers/${encodeURIComponent(customerId)}/portal-access`, body: { status }, responseSchema: portalAccessSchema }),
    onSuccess: (access) => queryClient.setQueryData(portalAccessKey(customerId), access),
  });
}
