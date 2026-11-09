import type { OrderItemStatus, OrderStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PaymentDto } from './payment.types';

/**
 * The parts of OrderDto (ENDPOINTS.md "Orders") the cashier needs. All money values are
 * server-calculated; the UI only displays them.
 */
export interface PayableOrderItem {
  id: Guid;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  modifiers: { name: string; priceDelta: number }[];
  comment: string | null;
  status: OrderItemStatus;
  lineTotal: number;
}

export interface PayableOrderSummary {
  id: Guid;
  number: number;
  type: 'dine_in' | 'takeaway';
  status: OrderStatus;
  tableNumber: string | null;
  waiterName: string | null;
  guestCount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  openedAt: Iso8601;
}

export interface PayableOrderDto extends PayableOrderSummary {
  items: PayableOrderItem[];
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount: number;
  taxAmount: number;
  comment: string | null;
  payments: PaymentDto[];
}
