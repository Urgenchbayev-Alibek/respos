import type { PaymentDto } from '@/entities/payment/payment.types';
import { ORDER_STATUSES, type OrderItemStatus, type OrderStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export type OrderType = 'dine_in' | 'takeaway';
export const ORDER_TYPES: readonly OrderType[] = ['dine_in', 'takeaway'];

/** Backend `Orders/Common/OrderDtos.cs` OrderItemDto. */
export interface OrderItemDto {
  id: Guid;
  menuItemId: Guid;
  variantId: Guid | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  modifiers: { name: string; priceDelta: number }[];
  comment: string | null;
  status: OrderItemStatus;
  lineTotal: number;
  stationId: Guid | null;
  sentAt: Iso8601 | null;
  readyAt: Iso8601 | null;
  cancelReason: string | null;
}

export type { PaymentDto };

export const DISCOUNT_TYPES = ['none', 'amount', 'percent'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface OrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByName: string | null;
  changedAt: Iso8601;
  reason: string | null;
}

/**
 * Fields used by list rows. The server always returns the full OrderDto (`GET /orders` paged,
 * `GET /orders/active` plain array), so a summary is just a narrower view of it.
 */
export interface OrderSummaryDto {
  id: Guid;
  number: number;
  /** `YYYY-MM-DD` in the branch timezone; `number` is unique per (branch, businessDate). */
  businessDate: string;
  type: OrderType;
  status: OrderStatus;
  tableId: Guid | null;
  tableNumber: string | null;
  waiterId: Guid;
  waiterName: string | null;
  guestCount: number;
  total: number;
  paidAmount: number;
  openedAt: Iso8601;
  closedAt: Iso8601 | null;
}

/** `GET /orders/{id}` — totals are server-calculated; the UI only displays them. */
export interface OrderDto extends OrderSummaryDto {
  items: OrderItemDto[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  serviceChargeAmount: number;
  taxAmount: number;
  remainingAmount: number;
  comment: string | null;
  cancelReason: string | null;
  payments: PaymentDto[];
  history: OrderHistoryEntry[];
}

/** `GET /orders`: `status` = comma list, `from`/`to` = UTC instants (openedAt), `search` = order number. */
export interface OrderListParams extends PageParams {
  status?: readonly OrderStatus[];
  tableId?: string;
  waiterId?: string;
  from?: string;
  to?: string;
  type?: OrderType;
}

export interface AddOrderItem {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  modifierOptionIds: string[];
  comment?: string;
}

export interface CreateOrderInput {
  type: OrderType;
  tableId?: string;
  guestCount: number;
  comment?: string;
  items?: AddOrderItem[];
}

/** `POST /orders/{id}/discount` [orders.discount.apply]: reason required unless `none`; the server caps it at the subtotal. */
export interface ApplyDiscountInput {
  type: DiscountType;
  value: number;
  reason: string;
}

/** `PUT /orders/{id}/items/{itemId}` — only items still in status `new`. */
export interface UpdateOrderItemInput {
  quantity: number;
  comment: string | null;
}

/** `#0042` */
export function formatOrderNumber(number: number | null | undefined): string {
  return number === null || number === undefined ? '—' : `#${String(number).padStart(4, '0')}`;
}

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['paid', 'cancelled'];
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (status) => !TERMINAL_ORDER_STATUSES.includes(status),
);

export function isOrderOpen(order: Pick<OrderSummaryDto, 'status'>): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(order.status);
}
