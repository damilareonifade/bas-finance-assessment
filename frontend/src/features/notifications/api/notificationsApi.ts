import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { inboxSchema } from '../schemas/notification';

export const notificationKeys = { inbox: ['notifications', 'inbox'] as const };

/** How often the bell checks for news. No websockets in this scope — a light poll is enough for a back office. */
export const NOTIFICATION_POLL_MS = 30_000;

export function useInboxQuery() {
  return useQuery({
    queryKey: notificationKeys.inbox,
    queryFn: () => apiRequest({ method: 'GET', path: '/notifications?limit=20', responseSchema: inboxSchema }),
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest({ method: 'POST', path: `/notifications/${encodeURIComponent(notificationId)}/read`, responseSchema: inboxSchema }),
    onSuccess: (inbox) => queryClient.setQueryData(notificationKeys.inbox, inbox),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest({ method: 'POST', path: '/notifications/read-all', responseSchema: inboxSchema }),
    onSuccess: (inbox) => queryClient.setQueryData(notificationKeys.inbox, inbox),
  });
}
