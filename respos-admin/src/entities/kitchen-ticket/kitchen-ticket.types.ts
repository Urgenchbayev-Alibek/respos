import type { TicketStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** KitchenTicketItem status (DECISIONS_v1_1 §3) — serving is tracked on the order item only. */
export type KitchenTicketItemStatus = 'new' | 'preparing' | 'ready' | 'cancelled';

export interface KitchenTicketItemDto {
  id: Guid;
  orderItemId: Guid;
  name: string;
  variantName: string | null;
  quantity: number;
  modifiers: string[];
  comment: string | null;
  status: KitchenTicketItemStatus;
}

/** `GET /kitchen/tickets` (ENDPOINTS.md "Kitchen / KDS"), sorted by createdAt asc. */
export interface KitchenTicketDto {
  id: Guid;
  number: number;
  orderId: Guid;
  orderNumber: number;
  tableNumber: string | null;
  waiterName: string | null;
  stationId: Guid;
  stationName: string;
  status: TicketStatus;
  createdAt: Iso8601;
  startedAt: Iso8601 | null;
  readyAt: Iso8601 | null;
  items: KitchenTicketItemDto[];
}

export interface KitchenTicketParams {
  stationId?: string;
  status: readonly TicketStatus[];
}

export type TicketAction = 'start' | 'ready' | 'served' | 'recall';
export type TicketItemAction = 'start' | 'ready';
