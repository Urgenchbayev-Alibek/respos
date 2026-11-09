import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export const NOTIFICATION_TYPES = [
  'order_new', 'order_status', 'order_ready', 'stock_low', 'purchase_received', 'integration_error', 'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationDto {
  id: Guid;
  type: NotificationType;
  title: string;
  body: string | null;
  /** In-app path (e.g. `/admin/orders`); external links are ignored by the UI. */
  link: string | null;
  /** null = organization-wide. */
  branchId: Guid | null;
  isRead: boolean;
  createdAt: Iso8601;
  readAt: Iso8601 | null;
}

export interface NotificationListParams extends PageParams {
  unreadOnly?: boolean;
}

/** `GET /notifications/unread-count` and `POST /notifications/read-all` (number marked read). */
export interface CountDto {
  count: number;
}
