import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashShiftKeys } from '@/entities/cash-shift/cash-shift.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { PayableOrderDto, PayableOrderSummary } from './payable-order.types';
import type { CreatePaymentInput, CreateRefundInput, PaymentDto, PaymentListParams } from './payment.types';

export const paymentKeys = {
  all: ['payments'] as const,
  list: (params: PaymentListParams) => [...paymentKeys.all, 'list', params] as const,
};

/** Same root as the orders entity (`['orders']`) so order invalidations from any workspace reach the cashier. */
export const payableOrderKeys = {
  all: ['orders'] as const,
  active: () => [...payableOrderKeys.all, 'active'] as const,
  detail: (id: string) => [...payableOrderKeys.all, 'detail', id] as const,
};

export function usePayments(params: PaymentListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<PaymentDto>>(ENDPOINTS.payments.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** `GET /orders/active` — accepts a plain array or a paged result. */
export function useActiveOrders() {
  return useQuery({
    queryKey: payableOrderKeys.active(),
    queryFn: async ({ signal }) => {
      const data = await apiClient.get<PayableOrderSummary[] | PagedResult<PayableOrderSummary>>(ENDPOINTS.orders.active, {
        signal,
      });
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function usePayableOrder(id: string | null) {
  return useQuery({
    queryKey: payableOrderKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<PayableOrderDto>(ENDPOINTS.orders.one(id ?? ''), { signal }),
    enabled: Boolean(id),
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

/** `POST /payments` — the caller owns the Idempotency-Key (one per user action, reused on retry). */
export function useCreatePayment() {
  const invalidate = useInvalidatePaymentData();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreatePaymentInput; idempotencyKey: string }) =>
      apiClient.post<PaymentDto>(ENDPOINTS.payments.list, input, { idempotencyKey }),
    onSuccess: invalidate,
  });
}

export function useCreateRefund() {
  const invalidate = useInvalidatePaymentData();
  return useMutation({
    mutationFn: ({ paymentId, input, idempotencyKey }: { paymentId: string; input: CreateRefundInput; idempotencyKey: string }) =>
      apiClient.post<unknown>(ENDPOINTS.payments.refunds(paymentId), input, { idempotencyKey }),
    onSuccess: invalidate,
  });
}
