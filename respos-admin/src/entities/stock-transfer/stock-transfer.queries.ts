import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInvalidateStock } from '@/entities/stock/stock.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { StockTransferDto, TransferAction, TransferInput, TransferListParams } from './stock-transfer.types';

export const transferKeys = {
  all: ['stock-transfers'] as const,
  list: (params: TransferListParams) => [...transferKeys.all, 'list', params] as const,
  detail: (id: string) => [...transferKeys.all, 'detail', id] as const,
};

export function useStockTransfers(params: TransferListParams) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<StockTransferDto>>(ENDPOINTS.inventory.transfers, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useStockTransfer(id: string | undefined) {
  return useQuery({
    queryKey: transferKeys.detail(id ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<StockTransferDto>(ENDPOINTS.inventory.transfer(id ?? ''), {
        signal,
      }),
    enabled: Boolean(id),
  });
}

function useInvalidateTransfers() {
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: transferKeys.all }), invalidateStock()]);
}

export function useSaveStockTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TransferInput }) =>
      id
        ? apiClient.put<StockTransferDto>(ENDPOINTS.inventory.transfer(id), input)
        : apiClient.post<StockTransferDto>(ENDPOINTS.inventory.transfers, input),
    onSuccess: invalidate,
  });
}

export function useStockTransferAction() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: TransferAction }) =>
      apiClient.post<StockTransferDto>(ENDPOINTS.inventory.transferAction(id, action)),
    onSuccess: invalidate,
  });
}

/** `POST /stock/transfers/{id}/receive` — destination branch, requires Idempotency-Key. */
export function useReceiveStockTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      apiClient.post<StockTransferDto>(ENDPOINTS.inventory.transferAction(id, 'receive'), undefined, { idempotencyKey }),
    onSuccess: invalidate,
  });
}
