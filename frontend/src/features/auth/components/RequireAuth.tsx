import { createContext, useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryState';
import { ApiError } from '@/lib/api';
import { useSessionQuery } from '../api/authApi';
import type { SessionUser, UserRole } from '../schemas/auth';

const CurrentUserContext = createContext<SessionUser | null>(null);

/** The signed-in user. Only usable underneath <RequireAuth>. */
export function useCurrentUser(): SessionUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside <RequireAuth>');
  return user;
}

/** Route guard: shows a skeleton while the session loads, redirects to /login when signed out. */
export function RequireAuth() {
  const sessionQuery = useSessionQuery();
  const location = useLocation();

  if (sessionQuery.isPending) return <Skeleton className="m-8 h-40" />;
  if (sessionQuery.isError) {
    const isSignedOut = sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401;
    if (isSignedOut) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return <QueryError error={sessionQuery.error} onRetry={() => void sessionQuery.refetch()} />;
  }
  return (
    <CurrentUserContext.Provider value={sessionQuery.data}>
      <Outlet />
    </CurrentUserContext.Provider>
  );
}

interface RequireRoleProps {
  readonly roles: readonly UserRole[];
}

/** Route guard for role-restricted pages. The server enforces the same rule; this only avoids dead-end screens. */
export function RequireRole({ roles }: RequireRoleProps) {
  const user = useCurrentUser();
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}

export function homePathFor(role: UserRole): string {
  return role === 'ADMIN' ? '/admin' : '/collections';
}
