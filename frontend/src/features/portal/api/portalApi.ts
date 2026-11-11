import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import {
  portalApplicationSchema,
  portalDocumentSchema,
  portalInboxSchema,
  portalInvitationPreviewSchema,
  portalInvoiceSchema,
  portalLoanDetailSchema,
  portalLoanSummarySchema,
  portalOverviewSchema,
  portalProductSchema,
  portalQuoteSchema,
  portalSessionResponseSchema,
  type PortalLoginRequest,
} from '../schemas/portal';

/** Every portal query key starts with "portal", so a 401 on any of them re-checks the portal session. */
export const portalKeys = {
  all: ['portal'] as const,
  session: ['portal', 'session'] as const,
  invitation: (token: string) => ['portal', 'invitation', token] as const,
  overview: ['portal', 'overview'] as const,
  loans: ['portal', 'loans'] as const,
  loan: (loanId: string) => ['portal', 'loan', loanId] as const,
  invoices: ['portal', 'invoices'] as const,
  invoice: (invoiceId: string) => ['portal', 'invoice', invoiceId] as const,
  applications: ['portal', 'applications'] as const,
  products: ['portal', 'products'] as const,
  quote: (input: QuoteInput) => ['portal', 'quote', input] as const,
  documents: ['portal', 'documents'] as const,
  inbox: ['portal', 'inbox'] as const,
};

export interface QuoteInput {
  readonly loanProductId: string;
  readonly principalKobo: number;
  readonly termMonths: number;
}

export function usePortalSessionQuery() {
  return useQuery({
    queryKey: portalKeys.session,
    queryFn: async () => (await apiRequest({ method: 'GET', path: '/portal/auth/me', responseSchema: portalSessionResponseSchema })).customer,
    staleTime: 5 * 60_000,
  });
}

export function usePortalLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PortalLoginRequest) => apiRequest({ method: 'POST', path: '/portal/auth/login', body: request, responseSchema: portalSessionResponseSchema }),
    onSuccess: ({ customer }) => {
      queryClient.removeQueries({ queryKey: portalKeys.all });
      queryClient.setQueryData(portalKeys.session, customer);
    },
  });
}

export function usePortalLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest({ method: 'POST', path: '/portal/auth/logout', responseSchema: z.null() }),
    onSettled: () => queryClient.removeQueries({ queryKey: portalKeys.all }),
  });
}

export function usePortalInvitationQuery(token: string) {
  return useQuery({
    queryKey: portalKeys.invitation(token),
    queryFn: () => apiRequest({ method: 'GET', path: `/portal/auth/invitations/${encodeURIComponent(token)}`, responseSchema: portalInvitationPreviewSchema }),
    enabled: token.length > 0,
  });
}

export function usePortalAcceptInvitationMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => apiRequest({ method: 'POST', path: '/portal/auth/accept-invitation', body: { token, password }, responseSchema: portalSessionResponseSchema }),
    onSuccess: ({ customer }) => {
      queryClient.removeQueries({ queryKey: portalKeys.all });
      queryClient.setQueryData(portalKeys.session, customer);
    },
  });
}

export function usePortalOverviewQuery() {
  return useQuery({ queryKey: portalKeys.overview, queryFn: () => apiRequest({ method: 'GET', path: '/portal/overview', responseSchema: portalOverviewSchema }) });
}

export function usePortalLoansQuery() {
  return useQuery({ queryKey: portalKeys.loans, queryFn: () => apiRequest({ method: 'GET', path: '/portal/loans', responseSchema: z.array(portalLoanSummarySchema) }) });
}

export function usePortalInvoicesQuery() {
  return useQuery({ queryKey: portalKeys.invoices, queryFn: () => apiRequest({ method: 'GET', path: '/portal/invoices', responseSchema: z.array(portalInvoiceSchema) }) });
}

export function usePortalInvoiceQuery(invoiceId: string) {
  return useQuery({
    queryKey: portalKeys.invoice(invoiceId),
    queryFn: () => apiRequest({ method: 'GET', path: `/portal/invoices/${encodeURIComponent(invoiceId)}`, responseSchema: portalInvoiceSchema }),
  });
}

export function usePortalApplicationsQuery() {
  return useQuery({
    queryKey: portalKeys.applications,
    queryFn: () => apiRequest({ method: 'GET', path: '/portal/applications', responseSchema: z.array(portalApplicationSchema) }),
  });
}

export function usePortalLoanQuery(loanId: string) {
  return useQuery({
    queryKey: portalKeys.loan(loanId),
    queryFn: () => apiRequest({ method: 'GET', path: `/portal/loans/${encodeURIComponent(loanId)}`, responseSchema: portalLoanDetailSchema }),
  });
}

export function usePortalProductsQuery() {
  return useQuery({ queryKey: portalKeys.products, queryFn: () => apiRequest({ method: 'GET', path: '/portal/products', responseSchema: z.array(portalProductSchema) }) });
}

/** The server's schedule for the terms being considered (only asked once the form is valid). */
export function usePortalQuoteQuery(input: QuoteInput | null) {
  return useQuery({
    queryKey: portalKeys.quote(input ?? { loanProductId: '', principalKobo: 0, termMonths: 0 }),
    queryFn: () => apiRequest({ method: 'POST', path: '/portal/quote', body: input, responseSchema: portalQuoteSchema }),
    enabled: input !== null,
    staleTime: 60_000,
  });
}

export function usePortalApplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: QuoteInput & { purpose?: string }) => apiRequest({ method: 'POST', path: '/portal/applications', body: request, responseSchema: portalApplicationSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portalKeys.overview });
      void queryClient.invalidateQueries({ queryKey: portalKeys.applications });
      void queryClient.invalidateQueries({ queryKey: portalKeys.inbox });
    },
  });
}

export function usePortalDocumentsQuery() {
  return useQuery({ queryKey: portalKeys.documents, queryFn: () => apiRequest({ method: 'GET', path: '/portal/documents', responseSchema: z.array(portalDocumentSchema) }) });
}

export function usePortalSubmitDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, identifier, file }: { type: string; identifier: string; file: File | null }) => {
      const form = new FormData();
      form.set('type', type);
      if (identifier.trim()) form.set('identifier', identifier.trim());
      if (file) form.set('file', file);
      return apiRequest({ method: 'POST', path: '/portal/documents', body: form, responseSchema: portalDocumentSchema });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portalKeys.documents });
      void queryClient.invalidateQueries({ queryKey: portalKeys.overview });
    },
  });
}

export function usePortalInboxQuery() {
  return useQuery({
    queryKey: portalKeys.inbox,
    queryFn: () => apiRequest({ method: 'GET', path: '/portal/notifications', responseSchema: portalInboxSchema }),
    refetchInterval: 30_000,
  });
}

export function usePortalMarkAllReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest({ method: 'POST', path: '/portal/notifications/read-all', responseSchema: portalInboxSchema }),
    onSuccess: (inbox) => queryClient.setQueryData(portalKeys.inbox, inbox),
  });
}
