import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { useRealtimeEvent } from '@/shared/realtime';
import type { PagedResult } from '@/shared/types/pagination';
import type { NotificationDto, NotificationListParams, UnreadCountDto } from './notification.types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params: NotificationListParams) => [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

const UNREAD_POLL_MS = 120_000;

export function useNotifications(params: NotificationListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<NotificationDto>>(ENDPOINTS.notifications.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Accepts `{ count }` (contract) or a bare number. */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async ({ signal }) => {
      const data = await apiClient.get<UnreadCountDto | number>(ENDPOINTS.notifications.unreadCount, { signal });
      return typeof data === 'number' ? data : (data?.count ?? 0);
    },
    refetchInterval: UNREAD_POLL_MS,
    enabled,
  });
}

/** NotificationCreated is a hint: refetch counter + lists. */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  useRealtimeEvent('NotificationCreated', () => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(ENDPOINTS.notifications.read(id)),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => apiClient.post<void>(ENDPOINTS.notifications.readAll),
    onSuccess: invalidate,
  });
}
