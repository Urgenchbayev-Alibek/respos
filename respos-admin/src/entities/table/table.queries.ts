import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { compareTableNumbers, type ManualTableStatus, type TableDto, type TableInput, type TableListParams } from './table.types';

export const tableKeys = {
  all: ['tables'] as const,
  list: (params: TableListParams = {}) => [...tableKeys.all, 'list', params] as const,
};

function sortTables(tables: TableDto[]): TableDto[] {
  return [...tables].sort(compareTableNumbers);
}

export function useTables(params: TableListParams = {}) {
  return useQuery({
    queryKey: tableKeys.list(params),
    queryFn: ({ signal }) => apiClient.get<TableDto[]>(ENDPOINTS.tables.list, { params: { ...params }, signal }),
    select: sortTables,
  });
}

function useInvalidateTables() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tableKeys.all });
}

export function useSaveTable() {
  const invalidate = useInvalidateTables();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TableInput }) =>
      id ? apiClient.put<TableDto>(ENDPOINTS.tables.one(id), input) : apiClient.post<TableDto>(ENDPOINTS.tables.list, input),
    onSuccess: invalidate,
  });
}

export function useArchiveTable() {
  const invalidate = useInvalidateTables();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.tables.one(id)),
    onSuccess: invalidate,
  });
}

export function useSetTableStatus() {
  const invalidate = useInvalidateTables();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualTableStatus }) =>
      apiClient.post<TableDto>(ENDPOINTS.tables.status(id), { status }),
    onSuccess: invalidate,
  });
}
