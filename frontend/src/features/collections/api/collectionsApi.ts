import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { collectionsSchema } from '../schemas/collections';

export const collectionsKeys = {
  all: ['collections'] as const,
  forOfficer: (officerId: string | undefined) => [...collectionsKeys.all, officerId ?? 'self'] as const,
};

/** Officers get their own book; administrators may pass an officer id to look at someone else's. */
export function useCollectionsQuery(officerId?: string) {
  return useQuery({
    queryKey: collectionsKeys.forOfficer(officerId),
    queryFn: () => apiRequest({ method: 'GET', path: `/collections/portfolio${officerId ? `?officerId=${encodeURIComponent(officerId)}` : ''}`, responseSchema: collectionsSchema }),
  });
}
