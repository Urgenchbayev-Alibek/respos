import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderKeys, useInvalidateOrders } from '@/entities/order/order.queries';
import type { OrderDto } from '@/entities/order/order.types';
import { apiClient } from '@/shared/api/api-client';
import type { PageParams, PagedResult } from '@/shared/types/pagination';
import { CUSTOMER_ENDPOINTS as E } from './customer.endpoints';
import type {
  CustomerDto,
  CustomerInput,
  CustomerListItemDto,
  CustomerListParams,
  CustomerOrderDto,
  LoyaltySettingsDto,
  LoyaltyTransactionDto,
  OrderLoyaltyDto,
} from './customer.types';

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: CustomerListParams) => [...customerKeys.all, 'list', params] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
  orders: (id: string, params: PageParams) => [...customerKeys.all, 'orders', id, params] as const,
  ledger: (id: string, params: PageParams) => [...customerKeys.all, 'ledger', id, params] as const,
  loyaltySettings: () => [...customerKeys.all, 'loyalty-settings'] as const,
  orderLoyalty: (orderId: string) => [...customerKeys.all, 'order-loyalty', orderId] as const,
};

export function useCustomers(params: CustomerListParams, enabled = true) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<CustomerListItemDto>>(E.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<CustomerDto>(E.one(id ?? ''), { signal }),
    enabled: Boolean(id),
  });
}

export function useCustomerOrders(id: string, params: PageParams) {
  return useQuery({
    queryKey: customerKeys.orders(id, params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<CustomerOrderDto>>(E.orders(id), { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerLedger(id: string, params: PageParams) {
  return useQuery({
    queryKey: customerKeys.ledger(id, params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<LoyaltyTransactionDto>>(E.ledger(id), { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CustomerInput }) =>
      id ? apiClient.put<CustomerDto>(E.one(id), input) : apiClient.post<CustomerDto>(E.list, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(E.one(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useLoyaltySettings() {
  return useQuery({
    queryKey: customerKeys.loyaltySettings(),
    queryFn: ({ signal }) => apiClient.get<LoyaltySettingsDto>(E.loyaltySettings, { signal }),
  });
}

export function useSaveLoyaltySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoyaltySettingsDto) => apiClient.put<LoyaltySettingsDto>(E.loyaltySettings, input),
    onSuccess: (data) => queryClient.setQueryData(customerKeys.loyaltySettings(), data),
  });
}

export function useOrderLoyalty(orderId: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.orderLoyalty(orderId),
    queryFn: ({ signal }) => apiClient.get<OrderLoyaltyDto>(E.orderLoyalty(orderId), { signal }),
    enabled,
  });
}

/** Order mutations of F1: the returned OrderDto replaces the cached detail; orders + guest data refetch. */
function useGuestOrderMutation<TVars>(mutationFn: (vars: TVars) => Promise<OrderDto>) {
  const queryClient = useQueryClient();
  const invalidateOrders = useInvalidateOrders();
  return useMutation({
    mutationFn,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      return Promise.all([invalidateOrders(), queryClient.invalidateQueries({ queryKey: customerKeys.all })]);
    },
  });
}

export function useAttachCustomer() {
  return useGuestOrderMutation(({ orderId, customerId }: { orderId: string; customerId: string }) =>
    apiClient.post<OrderDto>(E.orderCustomer(orderId), { customerId }),
  );
}

export function useDetachCustomer() {
  return useGuestOrderMutation((orderId: string) => apiClient.delete<OrderDto>(E.orderCustomer(orderId)));
}

export function useRedeemPoints() {
  return useGuestOrderMutation(({ orderId, points }: { orderId: string; points: number }) =>
    apiClient.post<OrderDto>(E.orderRedeem(orderId), { points }),
  );
}

export function useCancelRedemption() {
  return useGuestOrderMutation((orderId: string) => apiClient.delete<OrderDto>(E.orderRedeem(orderId)));
}
