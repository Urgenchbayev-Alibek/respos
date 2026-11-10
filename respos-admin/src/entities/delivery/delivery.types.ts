import type { AddOrderItem } from '@/entities/order/order.types';
import type { OrderItemStatus, OrderStatus, StatusTone } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** Delivery lifecycle (respos-contracts/v2/F3-delivery.md) — separate from the order status. */
export const DELIVERY_STATUSES = ['new', 'accepted', 'cooking', 'ready', 'on_the_way', 'delivered', 'cancelled'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Kanban columns of the board (closed statuses share the last column). */
export const BOARD_COLUMNS = ['new', 'accepted', 'cooking', 'ready', 'on_the_way', 'done'] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export const DELIVERY_TONES = {
  new: 'info',
  accepted: 'primary',
  cooking: 'warning',
  ready: 'success',
  on_the_way: 'primary',
  delivered: 'neutral',
  cancelled: 'danger',
} as const satisfies Record<DeliveryStatus, StatusTone>;

export function boardColumnOf(status: DeliveryStatus): BoardColumn {
  return status === 'delivered' || status === 'cancelled' ? 'done' : status;
}

export interface CourierDto {
  id: Guid;
  name: string;
  phone: string;
  isActive: boolean;
}

export interface CourierInput {
  name: string;
  phone: string;
  isActive: boolean;
}

export interface DeliveryItemDto {
  id: Guid;
  name: string;
  variantName: string | null;
  quantity: number;
  status: OrderItemStatus;
  lineTotal: number;
}

export interface DeliveryOrderDto {
  orderId: Guid;
  orderNumber: number;
  displayNumber: string;
  orderStatus: OrderStatus;
  status: DeliveryStatus;
  allowedTransitions: DeliveryStatus[];
  customerName: string;
  customerPhone: string;
  address: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  comment: string | null;
  courier: CourierDto | null;
  items: DeliveryItemDto[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: Iso8601;
  statusChangedAt: Iso8601;
  acceptedAt: Iso8601 | null;
  cookingAt: Iso8601 | null;
  readyAt: Iso8601 | null;
  onTheWayAt: Iso8601 | null;
  deliveredAt: Iso8601 | null;
  cancelledAt: Iso8601 | null;
  cancelReason: string | null;
}

export interface DeliveryDetailsInput {
  customerName: string;
  customerPhone: string;
  address: string;
  entrance?: string;
  floor?: string;
  apartment?: string;
  comment?: string;
}

export interface CreateDeliveryInput extends DeliveryDetailsInput {
  courierId?: string;
  items: AddOrderItem[];
}

export interface DeliverySettingsDto {
  branchId: Guid;
  slug: string | null;
  deliveryFee: number;
}

export interface DeliverySettingsInput {
  slug: string;
  deliveryFee: number;
}

/** `tel:` link for click-to-call (phones are stored normalized, e.g. +998901234567). */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}
