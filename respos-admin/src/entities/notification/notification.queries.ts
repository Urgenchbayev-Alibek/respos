import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { useRealtimeEvent } from '@/shared/realtime';
import type { PagedResult } from '@/shared/types/pagination';
import type { CountDto, NotificationDto, NotificationListParams } from './notification.types';

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
      apiClient.get<PagedResult<NotificationDto>>(ENDPOINTS.notifications.list, { params: { ...params }, signal, branchId: null }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** `GET /notifications/unread-count` → `{ count }`. */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async ({ signal }) =>
      (await apiClient.get<CountDto>(ENDPOINTS.notifications.unreadCount, { signal, branchId: null })).count,
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
    mutationFn: (id: string) => apiClient.post<NotificationDto>(ENDPOINTS.notifications.read(id), undefined, { branchId: null }),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => apiClient.post<CountDto>(ENDPOINTS.notifications.readAll, undefined, { branchId: null }),
    onSuccess: invalidate,
  });
}
