import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchKeys } from '@/entities/branch/branch.queries';
import { orderKeys } from '@/entities/order/order.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type {
  CourierDto,
  CourierInput,
  CreateDeliveryInput,
  DeliveryOrderDto,
  DeliverySettingsDto,
  DeliverySettingsInput,
  DeliveryStatus,
} from './delivery.types';

export const deliveryKeys = {
  all: ['delivery'] as const,
  board: () => [...deliveryKeys.all, 'board'] as const,
  couriers: (includeInactive: boolean) => [...deliveryKeys.all, 'couriers', includeInactive] as const,
  settings: (branchId: string) => [...deliveryKeys.all, 'settings', branchId] as const,
};

/** Board: open deliveries + those closed in the last 12 h (server default). */
export function useDeliveryBoard() {
  return useQuery({
    queryKey: deliveryKeys.board(),
    queryFn: ({ signal }) => apiClient.get<DeliveryOrderDto[]>(ENDPOINTS.delivery.orders, { signal }),
  });
}

export function useCouriers(includeInactive = false) {
  return useQuery({
    queryKey: deliveryKeys.couriers(includeInactive),
    queryFn: ({ signal }) =>
      apiClient.get<CourierDto[]>(ENDPOINTS.delivery.couriers, { signal, params: { includeInactive } }),
  });
}

function useDeliveryMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: deliveryKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      ]),
  });
}

export function useCreateDelivery() {
  return useDeliveryMutation((input: CreateDeliveryInput) =>
    apiClient.post<DeliveryOrderDto>(ENDPOINTS.delivery.orders, input),
  );
}

export function useChangeDeliveryStatus() {
  return useDeliveryMutation(
    ({ orderId, status, reason }: { orderId: string; status: DeliveryStatus; reason?: string }) =>
      apiClient.post<DeliveryOrderDto>(ENDPOINTS.delivery.status(orderId), { status, reason }),
  );
}

export function useAssignCourier() {
  return useDeliveryMutation(({ orderId, courierId }: { orderId: string; courierId: string | null }) =>
    apiClient.post<DeliveryOrderDto>(ENDPOINTS.delivery.courier(orderId), { courierId }),
  );
}

export function useSaveCourier() {
  return useDeliveryMutation(({ id, input }: { id?: string; input: CourierInput }) =>
    id
      ? apiClient.put<CourierDto>(ENDPOINTS.delivery.courierOne(id), input)
      : apiClient.post<CourierDto>(ENDPOINTS.delivery.couriers, input),
  );
}

/** Org-level (route branch id): no X-Branch-Id. */
const ORG_LEVEL = { branchId: null } as const;

export function useDeliverySettings(branchId: string) {
  return useQuery({
    queryKey: deliveryKeys.settings(branchId),
    queryFn: ({ signal }) =>
      apiClient.get<DeliverySettingsDto>(ENDPOINTS.branches.deliverySettings(branchId), { signal, ...ORG_LEVEL }),
    enabled: Boolean(branchId),
  });
}

export function useSaveDeliverySettings(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeliverySettingsInput) =>
      apiClient.put<DeliverySettingsDto>(ENDPOINTS.branches.deliverySettings(branchId), input, ORG_LEVEL),
    onSuccess: (data) => {
      queryClient.setQueryData(deliveryKeys.settings(branchId), data);
      return queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}
