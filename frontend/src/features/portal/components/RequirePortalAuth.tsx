import { createContext, useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api';
import { usePortalSessionQuery } from '../api/portalApi';
import type { PortalCustomer } from '../schemas/portal';

const CurrentCustomerContext = createContext<PortalCustomer | null>(null);

/** The signed-in customer. Only usable underneath <RequirePortalAuth>. */
export function useCurrentCustomer(): PortalCustomer {
  const customer = useContext(CurrentCustomerContext);
  if (!customer) throw new Error('useCurrentCustomer must be used inside <RequirePortalAuth>');
  return customer;
}

/** Portal route guard: signed-out customers go to /portal/login (never the staff sign-in). */
export function RequirePortalAuth() {
  const sessionQuery = usePortalSessionQuery();
  const location = useLocation();
  if (sessionQuery.isPending) return <Skeleton className="m-8 h-40" />;
  if (sessionQuery.isError) {
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401) return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />;
    return <QueryError error={sessionQuery.error} onRetry={() => void sessionQuery.refetch()} />;
  }
  return (
    <CurrentCustomerContext.Provider value={sessionQuery.data}>
      <Outlet />
    </CurrentCustomerContext.Provider>
  );
}
