import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashShiftKeys } from '@/entities/cash-shift/cash-shift.queries';
import { orderKeys, useActiveOrders, useOrder } from '@/entities/order/order.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { CreatePaymentInput, CreateRefundInput, PaymentDto, PaymentListParams, RefundDto } from './payment.types';

export const paymentKeys = {
  all: ['payments'] as const,
  list: (params: PaymentListParams) => [...paymentKeys.all, 'list', params] as const,
};

/** The cashier reads orders through the orders entity (same query keys → shared cache and invalidations). */
export const payableOrderKeys = orderKeys;
export { useActiveOrders };

export function usePayableOrder(id: string | null) {
  return useOrder(id ?? undefined);
}

export function usePayments(params: PaymentListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<PaymentDto>>(ENDPOINTS.payments.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

function useInvalidatePaymentData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
      queryClient.invalidateQueries({ queryKey: payableOrderKeys.all }),
      queryClient.invalidateQueries({ queryKey: cashShiftKeys.all }),
    ]);
}

/** `POST /payments` → 201 PaymentDto. The caller owns the Idempotency-Key (one per user action, reused on retry). */
export function useCreatePayment() {
  const invalidate = useInvalidatePaymentData();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreatePaymentInput; idempotencyKey: string }) =>
      apiClient.post<PaymentDto>(ENDPOINTS.payments.list, input, { idempotencyKey }),
    onSuccess: invalidate,
  });
}

/** `POST /payments/{id}/refunds` → 201 RefundDto (with the updated `payment`). Requires an Idempotency-Key. */
export function useCreateRefund() {
  const invalidate = useInvalidatePaymentData();
  return useMutation({
    mutationFn: ({ paymentId, input, idempotencyKey }: { paymentId: string; input: CreateRefundInput; idempotencyKey: string }) =>
      apiClient.post<RefundDto>(ENDPOINTS.payments.refunds(paymentId), input, { idempotencyKey }),
    onSuccess: invalidate,
  });
}
