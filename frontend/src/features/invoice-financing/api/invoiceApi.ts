import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import {
  financedInvoiceSchema,
  invoiceQuoteSchema,
  invoiceSchema,
  invoiceSettlementSchema,
  type InvoiceRequest,
  type SettlementRequest,
} from '../schemas/invoice';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: () => [...invoiceKeys.all, 'list'] as const,
  detail: (invoiceId: string) => [...invoiceKeys.all, 'detail', invoiceId] as const,
};

export function useInvoicesQuery() {
  return useQuery({ queryKey: invoiceKeys.list(), queryFn: () => apiRequest({ method: 'GET', path: '/invoices', responseSchema: z.array(invoiceSchema) }) });
}

function invoicePath(invoiceId: string): string {
  return `/invoices/${encodeURIComponent(invoiceId)}`;
}

export function useInvoiceQuery(invoiceId: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => apiRequest({ method: 'GET', path: invoicePath(invoiceId), responseSchema: invoiceSchema }),
  });
}

export function useRequestInvoiceQuoteMutation() {
  return useMutation({
    mutationFn: (request: InvoiceRequest) =>
      apiRequest({ method: 'POST', path: '/invoices/quote', body: request, responseSchema: invoiceQuoteSchema }),
  });
}

interface FinanceInvoiceVariables {
  readonly request: InvoiceRequest;
  readonly idempotencyKey: string;
}

export function useFinanceInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, idempotencyKey }: FinanceInvoiceVariables) =>
      apiRequest({ method: 'POST', path: '/invoices', body: request, idempotencyKey, responseSchema: financedInvoiceSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function usePreviewSettlementMutation(invoiceId: string) {
  return useMutation({
    mutationFn: (request: SettlementRequest) =>
      apiRequest({ method: 'POST', path: `${invoicePath(invoiceId)}/settlement/preview`, body: request, responseSchema: invoiceSettlementSchema }),
  });
}

interface SettleInvoiceVariables {
  readonly request: SettlementRequest;
  readonly idempotencyKey: string;
}

export function useSettleInvoiceMutation(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, idempotencyKey }: SettleInvoiceVariables) =>
      apiRequest({
        method: 'POST',
        path: `${invoicePath(invoiceId)}/settlement`,
        body: request,
        idempotencyKey,
        responseSchema: invoiceSettlementSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}
