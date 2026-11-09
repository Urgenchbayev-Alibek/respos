import type { PaymentStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export const PAYMENT_METHODS = ['cash', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** PaymentDto (backend `Payments/Common/PaymentDtos.cs`). `provider` is `manual` in MVP. */
export interface PaymentDto {
  id: Guid;
  orderId: Guid;
  /** Additive backend field: order number (unique per branch + business date). Absent on older servers. */
  orderNumber?: number;
  cashShiftId: Guid;
  method: PaymentMethod;
  amount: number;
  refundedAmount: number;
  status: PaymentStatus;
  provider: string;
  externalReference: string | null;
  createdAt: Iso8601;
  createdBy: Guid | null;
  createdByName: string | null;
}

/** `POST /payments/{id}/refunds` → 201 RefundDto; `payment` is the refunded payment after the refund. */
export interface RefundDto {
  id: Guid;
  paymentId: Guid;
  orderId: Guid;
  cashShiftId: Guid;
  method: PaymentMethod;
  amount: number;
  reason: string;
  createdAt: Iso8601;
  createdByName: string | null;
  payment: PaymentDto;
}

/** `sort` is ignored by the server (always createdAt desc). `from`/`to` are UTC instants. */
export interface PaymentListParams extends PageParams {
  from?: string;
  to?: string;
  method?: PaymentMethod;
  orderId?: string;
  shiftId?: string;
}

export interface CreatePaymentInput {
  orderId: Guid;
  method: PaymentMethod;
  amount: number;
  externalReference?: string;
}

export interface CreateRefundInput {
  amount: number;
  reason: string;
}
