import { apiRequest } from '@/lib/api';
import { originatedLoanSchema, termLoanListSchema, termLoanQuoteSchema, termLoanSchema, type TermLoanRequest } from '../schemas/termLoan';

export function requestTermLoanQuote(request: TermLoanRequest) {
  return apiRequest({ method: 'POST', path: '/term-loans/quote', body: request, responseSchema: termLoanQuoteSchema });
}

export function originateTermLoan(request: TermLoanRequest, idempotencyKey: string) {
  return apiRequest({ method: 'POST', path: '/term-loans', body: request, idempotencyKey, responseSchema: originatedLoanSchema });
}

export function fetchTermLoan(loanId: string) {
  return apiRequest({ method: 'GET', path: `/term-loans/${encodeURIComponent(loanId)}`, responseSchema: termLoanSchema });
}

export interface LoanListFilters {
  /** User id or "me". */
  readonly approvedBy?: string;
  /** User id or "me". */
  readonly officerId?: string;
}

export function fetchTermLoans(filters: LoanListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.approvedBy) params.set('approvedBy', filters.approvedBy);
  if (filters.officerId) params.set('officerId', filters.officerId);
  const query = params.toString();
  return apiRequest({ method: 'GET', path: `/term-loans${query ? `?${query}` : ''}`, responseSchema: termLoanListSchema });
}

