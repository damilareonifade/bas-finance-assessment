import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { authKeys } from '@/features/auth';
import { portalKeys } from '@/features/portal/api/portalApi';
import { ApiError } from '@/lib/api';

interface AppProvidersProps {
  readonly children: ReactNode;
}

function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401 && error.code !== 'INVALID_CREDENTIALS';
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => {
    // When any request comes back 401 the session is gone: re-check it so <RequireAuth> sends the user to /login.
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (!isSessionExpired(error)) return;
          // Portal queries belong to the customer session; everything else to the staff session.
          const session = query.queryKey[0] === portalKeys.all[0] ? portalKeys.session : authKeys.session;
          if (JSON.stringify(query.queryKey) !== JSON.stringify(session)) void client.invalidateQueries({ queryKey: session });
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (!isSessionExpired(error)) return;
          const onPortal = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal');
          void client.invalidateQueries({ queryKey: onPortal ? portalKeys.session : authKeys.session });
        },
      }),
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
    });
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
