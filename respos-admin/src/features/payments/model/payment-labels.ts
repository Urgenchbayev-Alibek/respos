import type { PaymentDto } from '@/entities/payment/payment.types';

/** Server-provided refundable amount (amount − refundedAmount); display/limit only. */
export function getRefundable(payment: Pick<PaymentDto, 'amount' | 'refundedAmount'>): number {
  return Math.max(0, Math.round((payment.amount - payment.refundedAmount) * 100) / 100);
}

export { formatOrderNumber } from '@/entities/order/order.types';
