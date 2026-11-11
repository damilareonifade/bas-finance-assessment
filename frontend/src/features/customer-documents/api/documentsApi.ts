import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { env } from '@/config/env';
import { applicationKeys } from '@/features/applications';
import { apiRequest } from '@/lib/api';
import { customerDocumentSchema, revealedDocumentSchema, type DocumentType } from '../schemas/document';

export const documentKeys = { forCustomer: (customerId: string) => ['customer-documents', customerId] as const };

const base = (customerId: string) => `/customers/${encodeURIComponent(customerId)}/documents`;

/** Opened in a new tab; the session cookie travels with it. */
export function documentFileUrl(customerId: string, documentId: string): string {
  return `${env.VITE_API_BASE_URL}${base(customerId)}/${encodeURIComponent(documentId)}/file`;
}

export function useCustomerDocumentsQuery(customerId: string) {
  return useQuery({ queryKey: documentKeys.forCustomer(customerId), queryFn: () => apiRequest({ method: 'GET', path: base(customerId), responseSchema: z.array(customerDocumentSchema) }) });
}

function useRefresh(customerId: string) {
  const queryClient = useQueryClient();
  // the application screen shows a verification summary, so refresh applications as well
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: documentKeys.forCustomer(customerId) }), queryClient.invalidateQueries({ queryKey: applicationKeys.all })]);
}

export function useRequestDocumentMutation(customerId: string) {
  const refresh = useRefresh(customerId);
  return useMutation({
    mutationFn: (input: { type: DocumentType; note?: string }) => apiRequest({ method: 'POST', path: `${base(customerId)}/requests`, body: input, responseSchema: customerDocumentSchema }),
    onSuccess: refresh,
  });
}

export function useSubmitDocumentMutation(customerId: string) {
  const refresh = useRefresh(customerId);
  return useMutation({
    mutationFn: (input: { type: DocumentType; identifier: string; file: File | null }) => {
      const form = new FormData();
      form.set('type', input.type);
      if (input.identifier.trim()) form.set('identifier', input.identifier.trim());
      if (input.file) form.set('file', input.file);
      return apiRequest({ method: 'POST', path: base(customerId), body: form, responseSchema: customerDocumentSchema });
    },
    onSuccess: refresh,
  });
}

export function useReviewDocumentMutation(customerId: string) {
  const refresh = useRefresh(customerId);
  return useMutation({
    mutationFn: (input: { documentId: string; decision: 'VERIFIED' | 'REJECTED'; note?: string }) =>
      apiRequest({
        method: 'POST',
        path: `${base(customerId)}/${encodeURIComponent(input.documentId)}/review`,
        body: { decision: input.decision, note: input.note },
        responseSchema: customerDocumentSchema,
      }),
    onSuccess: refresh,
  });
}

/** The full number, fetched only when someone asks to see it. */
export function useRevealDocumentMutation(customerId: string) {
  return useMutation({
    mutationFn: (documentId: string) => apiRequest({ method: 'GET', path: `${base(customerId)}/${encodeURIComponent(documentId)}`, responseSchema: revealedDocumentSchema }),
  });
}
