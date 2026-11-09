import { ORDER_STATUSES, type OrderItemStatus, type OrderStatus, type PaymentStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export type OrderType = 'dine_in' | 'takeaway';
export const ORDER_TYPES: readonly OrderType[] = ['dine_in', 'takeaway'];

export interface OrderItemDto {
  id: Guid;
  menuItemId: Guid;
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
}

export interface PaymentDto {
  id: Guid;
  orderId: Guid;
  method: 'cash' | 'card' | 'other';
  amount: number;
  refundedAmount: number;
  status: PaymentStatus;
  provider: string;
  createdAt: Iso8601;
  createdByName: string | null;
}

export interface OrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByName: string | null;
  changedAt: Iso8601;
  reason: string | null;
}

/** Fields shared by list rows and the full order. */
export interface OrderSummaryDto {
  id: Guid;
  number: number;
  type: OrderType;
  status: OrderStatus;
  tableId: Guid | null;
  tableNumber: string | null;
  waiterId: Guid | null;
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
  discountType: 'none' | 'amount' | 'percent';
  discountValue: number;
  discountAmount: number;
  serviceChargeAmount: number;
  taxAmount: number;
  remainingAmount: number;
  comment: string | null;
  payments: PaymentDto[];
  history: OrderHistoryEntry[];
}

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
