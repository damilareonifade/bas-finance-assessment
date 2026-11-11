import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTermLoan, fetchTermLoans, originateTermLoan, requestTermLoanQuote, type LoanListFilters } from './termLoanApi';
import { termLoanKeys } from './termLoanKeys';
import type { TermLoanRequest } from '../schemas/termLoan';

export function useTermLoanQuery(loanId: string) {
  return useQuery({ queryKey: termLoanKeys.detail(loanId), queryFn: () => fetchTermLoan(loanId) });
}

export function useTermLoansQuery(filters: LoanListFilters = {}) {
  return useQuery({ queryKey: termLoanKeys.list(filters), queryFn: () => fetchTermLoans(filters) });
}

export function useRequestTermLoanQuoteMutation() {
  return useMutation({ mutationFn: (request: TermLoanRequest) => requestTermLoanQuote(request) });
}

interface OriginateTermLoanVariables {
  readonly request: TermLoanRequest;
  readonly idempotencyKey: string;
}

export function useOriginateTermLoanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ request, idempotencyKey }: OriginateTermLoanVariables) => originateTermLoan(request, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: termLoanKeys.all }),
  });
}
