import type { CashShiftDto } from '@/entities/cash-shift/cash-shift.types';
import type { ReceiptDto } from '@/entities/order/receipt.types';
import type { PaymentDto, RefundDto } from '@/entities/payment/payment.types';

/** Payment / refund / cash shift / receipt test data mirroring backend `PaymentDtos.cs` and `GetReceiptHandler.cs`. */
export function makePayment(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: 'p1',
    orderId: 'o1',
    cashShiftId: 'sh1',
    method: 'cash',
    amount: 141500,
    refundedAmount: 0,
    status: 'completed',
    provider: 'manual',
    externalReference: null,
    createdAt: '2026-11-10T08:00:00Z',
    createdBy: '00000000-0000-0000-0000-000000000002',
    createdByName: 'Лола',
    ...overrides,
  };
}

export function makeRefund(overrides: Partial<RefundDto> = {}): RefundDto {
  const payment = overrides.payment ?? makePayment({ refundedAmount: 41500, status: 'partially_refunded' });
  return {
    id: 'r1',
    paymentId: payment.id,
    orderId: payment.orderId,
    cashShiftId: payment.cashShiftId,
    method: payment.method,
    amount: 41500,
    reason: 'Ошибка кассира',
    createdAt: '2026-11-10T09:00:00Z',
    createdByName: 'Лола',
    payment,
    ...overrides,
  };
}

export function makeCashShift(overrides: Partial<CashShiftDto> = {}): CashShiftDto {
  return {
    id: 'sh1',
    status: 'open',
    openedBy: '00000000-0000-0000-0000-000000000002',
    openedByName: 'Лола',
    openedAt: '2026-11-10T04:02:00Z',
    openingAmount: 500000,
    closedBy: null,
    closedByName: null,
    closedAt: null,
    expectedCashAmount: 800000,
    actualCashAmount: null,
    difference: null,
    comment: null,
    cashPaymentsAmount: 300000,
    cashRefundsAmount: 0,
    totalsByMethod: [{ method: 'cash', amount: 300000 }],
    ...overrides,
  };
}

export function makeReceipt(overrides: Partial<ReceiptDto> = {}): ReceiptDto {
  return {
    orderId: 'o1',
    number: 42,
    displayNumber: '#0042',
    type: 'dine_in',
    status: 'served',
    tableNumber: '7',
    waiterName: 'Шерзод',
    guestCount: 4,
    organizationName: 'Демо Ресторан',
    currency: 'UZS',
    branchName: 'Центр',
    branchAddress: 'ул. Навои, 1',
    branchPhone: null,
    items: [],
    subtotal: 265000,
    discountType: 'none',
    discountValue: 0,
    discountAmount: 0,
    serviceChargePercent: 10,
    serviceChargeAmount: 26500,
    taxPercent: 0,
    taxAmount: 0,
    total: 291500,
    paidAmount: 150000,
    remainingAmount: 141500,
    payments: [{ method: 'card', amount: 150000, refundedAmount: 0 }],
    openedAt: '2026-11-10T07:18:00Z',
    closedAt: null,
    printedAt: '2026-11-10T08:30:00Z',
    footer: 'Спасибо!',
    isFiscal: false,
    fiscalNotice: 'Не является фискальным чеком',
    ...overrides,
  };
}
