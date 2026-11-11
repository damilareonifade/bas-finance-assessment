import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { loanStatementSchema } from '../schemas/statement';

export const statementKeys = {
  all: ['statements'] as const,
  forLoan: (loanId: string) => [...statementKeys.all, loanId] as const,
};

export function fetchLoanStatement(loanId: string) {
  return apiRequest({ method: 'GET', path: `/term-loans/${encodeURIComponent(loanId)}/statement`, responseSchema: loanStatementSchema });
}

export function useLoanStatementQuery(loanId: string) {
  return useQuery({ queryKey: statementKeys.forLoan(loanId), queryFn: () => fetchLoanStatement(loanId) });
}
