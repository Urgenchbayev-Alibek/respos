import type { PaymentStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export const PAYMENT_METHODS = ['cash', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** PaymentDto (ENDPOINTS.md "Payments & cash shifts"). `provider` is `manual` in MVP. */
export interface PaymentDto {
  id: Guid;
  orderId: Guid;
  /** Not in the base DTO of the contract; shown when the server includes it. */
  orderNumber?: number;
  method: PaymentMethod;
  amount: number;
  refundedAmount: number;
  status: PaymentStatus;
  provider: string;
  createdAt: Iso8601;
  createdByName: string | null;
}

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
