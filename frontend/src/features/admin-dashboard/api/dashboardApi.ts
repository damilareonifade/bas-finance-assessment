import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { dashboardSchema } from '../schemas/dashboard';

export function useDashboardQuery() {
  return useQuery({ queryKey: ['admin', 'dashboard'] as const, queryFn: () => apiRequest({ method: 'GET', path: '/admin/dashboard', responseSchema: dashboardSchema }) });
}
