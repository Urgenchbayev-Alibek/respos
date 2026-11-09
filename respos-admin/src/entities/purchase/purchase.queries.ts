import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInvalidateStock } from '@/entities/stock/stock.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { PurchaseAction, PurchaseDto, PurchaseInput, PurchaseListParams, ReceiveInput } from './purchase.types';

export const purchaseKeys = {
  all: ['purchases'] as const,
  list: (params: PurchaseListParams) => [...purchaseKeys.all, 'list', params] as const,
  detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
};

export function usePurchases(params: PurchaseListParams) {
  return useQuery({
    queryKey: purchaseKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<PurchaseDto>>(ENDPOINTS.purchases.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: purchaseKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<PurchaseDto>(ENDPOINTS.purchases.one(id ?? ''), { signal }),
    enabled: Boolean(id),
  });
}

function useInvalidatePurchases() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
}

export function useSavePurchase() {
  const invalidate = useInvalidatePurchases();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PurchaseInput }) =>
      id
        ? apiClient.put<PurchaseDto>(ENDPOINTS.purchases.one(id), input)
        : apiClient.post<PurchaseDto>(ENDPOINTS.purchases.list, input),
    onSuccess: invalidate,
  });
}

export function usePurchaseAction() {
  const invalidate = useInvalidatePurchases();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: PurchaseAction }) =>
      apiClient.post<PurchaseDto>(ENDPOINTS.purchases.action(id, action)),
    onSuccess: invalidate,
  });
}

/** `POST /purchases/{id}/receive` — requires Idempotency-Key (one per user action, reused on retry). */
export function useReceivePurchase() {
  const invalidatePurchases = useInvalidatePurchases();
  const invalidateStock = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, input, idempotencyKey }: { id: string; input: ReceiveInput; idempotencyKey: string }) =>
      apiClient.post<PurchaseDto>(ENDPOINTS.purchases.action(id, 'receive'), input, { idempotencyKey }),
    onSuccess: () => Promise.all([invalidatePurchases(), invalidateStock()]),
  });
}
