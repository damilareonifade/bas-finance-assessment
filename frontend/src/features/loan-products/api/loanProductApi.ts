import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { loanProductDetailSchema, productCustomerSchema, type LoanProductRequest, type LoanProductUpdate } from '../schemas/loanProduct';

export type ProductStatusFilter = 'ACTIVE' | 'ARCHIVED';

export const loanProductKeys = {
  all: ['loan-products'] as const,
  list: (status?: ProductStatusFilter) => [...loanProductKeys.all, 'list', status ?? 'all'] as const,
  detail: (productId: string) => [...loanProductKeys.all, 'detail', productId] as const,
  customers: (productId: string) => [...loanProductKeys.all, 'customers', productId] as const,
};

export function useLoanProductsQuery(status?: ProductStatusFilter) {
  return useQuery({
    queryKey: loanProductKeys.list(status),
    queryFn: () => apiRequest({ method: 'GET', path: `/loan-products${status ? `?status=${status}` : ''}`, responseSchema: z.array(loanProductDetailSchema) }),
  });
}

export function useLoanProductQuery(productId: string) {
  return useQuery({
    queryKey: loanProductKeys.detail(productId),
    queryFn: () => apiRequest({ method: 'GET', path: `/loan-products/${encodeURIComponent(productId)}`, responseSchema: loanProductDetailSchema }),
  });
}

export function useProductCustomersQuery(productId: string) {
  return useQuery({
    queryKey: loanProductKeys.customers(productId),
    queryFn: () => apiRequest({ method: 'GET', path: `/loan-products/${encodeURIComponent(productId)}/customers`, responseSchema: z.array(productCustomerSchema) }),
  });
}

export function useCreateLoanProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: LoanProductRequest) => apiRequest({ method: 'POST', path: '/loan-products', body: request, responseSchema: loanProductDetailSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loanProductKeys.all }),
  });
}

interface UpdateLoanProductVariables {
  readonly productId: string;
  readonly changes: LoanProductUpdate;
}

export function useUpdateLoanProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, changes }: UpdateLoanProductVariables) =>
      apiRequest({ method: 'PATCH', path: `/loan-products/${encodeURIComponent(productId)}`, body: changes, responseSchema: loanProductDetailSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loanProductKeys.all }),
  });
}

interface SetProductStatusVariables {
  readonly productId: string;
  readonly status: ProductStatusFilter;
}

export function useSetProductStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, status }: SetProductStatusVariables) =>
      apiRequest({ method: 'PATCH', path: `/loan-products/${encodeURIComponent(productId)}`, body: { status }, responseSchema: loanProductDetailSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loanProductKeys.all }),
  });
}
