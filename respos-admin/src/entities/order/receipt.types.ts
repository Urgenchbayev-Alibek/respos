import type { PaymentMethod } from '@/entities/payment/payment.types';
import type { OrderStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { OrderDto, OrderItemDto, OrderType } from './order.types';

/**
 * `GET /orders/{id}/receipt` — printable pre-check (backend `Orders/GetReceipt/GetReceiptHandler.cs`).
 * NOT a fiscal receipt: `isFiscal` is always false and `fiscalNotice` is the server's "Не является фискальным чеком".
 * Cancelled items are already excluded by the server.
 */
export interface ReceiptDto
  extends Pick<
    OrderDto,
    | 'subtotal'
    | 'discountType'
    | 'discountValue'
    | 'discountAmount'
    | 'serviceChargeAmount'
    | 'taxAmount'
    | 'deliveryFee'
    | 'total'
    | 'paidAmount'
    | 'remainingAmount'
  > {
  orderId: Guid;
  number: number;
  /** `#0042` */
  displayNumber: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber: string | null;
  waiterName: string | null;
  guestCount: number;
  organizationName: string;
  currency: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  items: OrderItemDto[];
  serviceChargePercent: number;
  taxPercent: number;
  payments: { method: PaymentMethod; amount: number; refundedAmount: number }[];
  openedAt: Iso8601;
  closedAt: Iso8601 | null;
  printedAt: Iso8601;
  footer: string | null;
  isFiscal: false;
  fiscalNotice: string;
}
