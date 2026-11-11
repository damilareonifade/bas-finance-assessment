import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { ledgerSearchResultSchema, ledgerViewSchema, type LedgerFilter } from '../schemas/ledgerBook';

export const ledgerBookKeys = {
  all: ['ledger-book'] as const,
  search: (query: string) => ['ledger-book', 'search', query] as const,
  view: (filter: LedgerFilter) => ['ledger-book', 'view', filter] as const,
};

/** Customers matching a name / id / email / phone, or the owner of a loan, invoice or journal entry id. */
export function useLedgerSearchQuery(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ledgerBookKeys.search(trimmed),
    queryFn: () => apiRequest({ method: 'GET', path: `/ledger/search?q=${encodeURIComponent(trimmed)}`, responseSchema: z.array(ledgerSearchResultSchema) }),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useLedgerQuery(filter: LedgerFilter) {
  const params = new URLSearchParams();
  if (filter.customerId) params.set('customerId', filter.customerId);
  if (filter.loanProductId) params.set('loanProductId', filter.loanProductId);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  const queryString = params.toString();
  return useQuery({
    queryKey: ledgerBookKeys.view(filter),
    queryFn: () => apiRequest({ method: 'GET', path: `/ledger${queryString ? `?${queryString}` : ''}`, responseSchema: ledgerViewSchema }),
    placeholderData: keepPreviousData,
  });
}
