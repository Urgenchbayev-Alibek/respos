import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tableKeys } from '@/entities/table/table.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { AddOrderItem, CreateOrderInput, OrderDto, OrderListParams, OrderSummaryDto } from './order.types';

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListParams) => [...orderKeys.all, 'list', params] as const,
  active: () => [...orderKeys.all, 'active'] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
};

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<OrderSummaryDto>>(ENDPOINTS.orders.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

/** `GET /orders/active` — plain array (tolerates a paged envelope). */
export function useActiveOrders() {
  return useQuery({
    queryKey: orderKeys.active(),
    queryFn: async ({ signal }) => {
      const data = await apiClient.get<OrderSummaryDto[] | PagedResult<OrderSummaryDto>>(ENDPOINTS.orders.active, { signal });
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<OrderDto>(ENDPOINTS.orders.one(id ?? ''), { signal }),
    enabled: Boolean(id),
  });
}

/** Orders change table state too (occupied / activeOrderId / activeOrderTotal). */
export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: tableKeys.all }),
    ]);
}

function useOrderMutation<TVars>(mutationFn: (vars: TVars) => Promise<OrderDto>) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn,
    onSuccess: (order) => {
      if (order?.id) queryClient.setQueryData(orderKeys.detail(order.id), order);
      return invalidate();
    },
  });
}

export function useCreateOrder() {
  return useOrderMutation((input: CreateOrderInput) => apiClient.post<OrderDto>(ENDPOINTS.orders.list, input));
}

export function useAddOrderItems() {
  return useOrderMutation(({ orderId, items }: { orderId: string; items: AddOrderItem[] }) =>
    apiClient.post<OrderDto>(ENDPOINTS.orders.items(orderId), { items }),
  );
}

/** Requires an Idempotency-Key (one per user action, reused on retry). */
export function useSendToKitchen() {
  return useOrderMutation(({ orderId, idempotencyKey }: { orderId: string; idempotencyKey: string }) =>
    apiClient.post<OrderDto>(ENDPOINTS.orders.action(orderId, 'send-to-kitchen'), {}, { idempotencyKey }),
  );
}

export function useServeOrderItem() {
  return useOrderMutation(({ orderId, itemId }: { orderId: string; itemId: string }) =>
    apiClient.post<OrderDto>(ENDPOINTS.orders.itemAction(orderId, itemId, 'serve')),
  );
}

export function useServeAllItems() {
  return useOrderMutation((orderId: string) => apiClient.post<OrderDto>(ENDPOINTS.orders.action(orderId, 'serve-all')));
}

export function useCancelOrderItem() {
  return useOrderMutation(({ orderId, itemId, reason }: { orderId: string; itemId: string; reason: string }) =>
    apiClient.post<OrderDto>(ENDPOINTS.orders.itemAction(orderId, itemId, 'cancel'), { reason }),
  );
}

export function useCancelOrder() {
  return useOrderMutation(({ orderId, reason }: { orderId: string; reason: string }) =>
    apiClient.post<OrderDto>(ENDPOINTS.orders.action(orderId, 'cancel'), { reason }),
  );
}
