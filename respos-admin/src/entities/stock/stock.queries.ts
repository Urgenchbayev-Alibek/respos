import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ingredientKeys } from '@/entities/ingredient/ingredient.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PageParams, PagedResult } from '@/shared/types/pagination';
import type { CountLineInput, CreateMovementInput, InventoryCountDto, MovementListParams, StockMovementDto } from './stock.types';

export const movementKeys = {
  all: ['stock-movements'] as const,
  list: (params: MovementListParams) => [...movementKeys.all, 'list', params] as const,
};

export const countKeys = {
  all: ['stock-counts'] as const,
  list: (params: PageParams) => [...countKeys.all, 'list', params] as const,
  detail: (id: string) => [...countKeys.all, 'detail', id] as const,
};

/** Anything that changes a balance refreshes balances, the journal, counts, reports and the dashboard. */
export function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [ingredientKeys.all, movementKeys.all, countKeys.all, ['reports'], ['dashboard']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

export function useStockMovements(params: MovementListParams) {
  return useQuery({
    queryKey: movementKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<StockMovementDto>>(ENDPOINTS.inventory.movements, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateMovement() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (input: CreateMovementInput) => apiClient.post<StockMovementDto>(ENDPOINTS.inventory.movements, input),
    onSuccess: invalidate,
  });
}

export function useStockCounts(params: PageParams) {
  return useQuery({
    queryKey: countKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<InventoryCountDto>>(ENDPOINTS.inventory.counts, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useStockCount(id: string | null) {
  return useQuery({
    queryKey: countKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<InventoryCountDto>(ENDPOINTS.inventory.count(id ?? ''), { signal }),
    enabled: Boolean(id),
  });
}

export function useCreateCount() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: () => apiClient.post<InventoryCountDto>(ENDPOINTS.inventory.counts, {}),
    onSuccess: invalidate,
  });
}

export function useUpdateCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: CountLineInput[] }) =>
      apiClient.put<InventoryCountDto>(ENDPOINTS.inventory.count(id), { lines }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: countKeys.all }),
  });
}

export function useCompleteCount() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<InventoryCountDto>(ENDPOINTS.inventory.countComplete(id)),
    onSuccess: invalidate,
  });
}
