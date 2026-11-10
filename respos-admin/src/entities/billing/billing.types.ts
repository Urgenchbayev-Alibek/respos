import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** F2 contract: `respos-contracts/v2/F2-payments.md`. All money is server-calculated. */
export const BILL_SPLIT_MODES = ['equal', 'items', 'custom'] as const;
export type BillSplitMode = (typeof BILL_SPLIT_MODES)[number];
export type OrderBillStatus = 'open' | 'paid';

export interface OrderBillItemDto {
  orderItemId: Guid;
  quantity: number;
  amount: number;
}

export interface OrderBillDto {
  id: Guid;
  number: number;
  mode: BillSplitMode;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: OrderBillStatus;
  items: OrderBillItemDto[];
}

/** `POST /orders/{id}/split` [orders.split]. Unallocated item quantities form one extra last bill. */
export type SplitOrderInput =
  | { mode: 'equal'; parts: number }
  | { mode: 'custom'; amounts: number[] }
  | { mode: 'items'; bills: { items: { orderItemId: Guid; quantity: number }[] }[] };

/** «Не подключено» / «Тестовый режим» / «Подключено». */
export type IntegrationStatus = 'not_connected' | 'test' | 'connected';

export interface PaymentProviderDto {
  code: string;
  status: IntegrationStatus;
  isImplemented: boolean;
  isConfigured: boolean;
  isEnabled: boolean;
  /** implemented + configured + enabled for the branch. */
  isAvailable: boolean;
  callbackPath: string;
}

export interface FiscalStatusDto {
  code: string;
  status: IntegrationStatus;
}

export type PaymentIntentStatus = 'pending' | 'completed' | 'cancelled';

export interface PaymentIntentDto {
  id: Guid;
  orderId: Guid;
  billId: Guid | null;
  provider: string;
  amount: number;
  tipAmount: number;
  totalAmount: number;
  status: PaymentIntentStatus;
  isExpired: boolean;
  /** Customer payment link; also the QR payload. */
  paymentUrl: string | null;
  expiresAt: Iso8601;
  paymentId: Guid | null;
  createdAt: Iso8601;
}

export interface CreatePaymentIntentInput {
  orderId: Guid;
  billId?: Guid;
  provider: string;
  tipAmount: number;
}

export interface TipsReportDto {
  from: string;
  to: string;
  totalTips: number;
  rows: { waiterId: Guid; waiterName: string | null; tipsAmount: number; paymentsCount: number }[];
}
