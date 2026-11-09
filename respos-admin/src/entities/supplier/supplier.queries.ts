import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { MAX_PAGE_SIZE, type PagedResult } from '@/shared/types/pagination';
import type { SupplierDto, SupplierInput, SupplierListParams } from './supplier.types';

export const supplierKeys = {
  all: ['suppliers'] as const,
  list: (params: SupplierListParams) => [...supplierKeys.all, 'list', params] as const,
};

/** Suppliers are org-level. */
const ORG_LEVEL = { branchId: null } as const;

export function useSuppliers(params: SupplierListParams, enabled = true) {
  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<SupplierDto>>(ENDPOINTS.suppliers.list, { params: { ...params }, signal, ...ORG_LEVEL }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSupplierOptions(enabled = true) {
  return useSuppliers({ page: 1, pageSize: MAX_PAGE_SIZE, sort: 'name:asc' }, enabled);
}

export function useSaveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SupplierInput }) =>
      id
        ? apiClient.put<SupplierDto>(ENDPOINTS.suppliers.one(id), input, ORG_LEVEL)
        : apiClient.post<SupplierDto>(ENDPOINTS.suppliers.list, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  });
}

export function useArchiveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(ENDPOINTS.suppliers.archive(id), undefined, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  });
}
