import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PermissionDto, RoleDto, RoleInput } from './role.types';

export const roleKeys = {
  all: ['roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const,
  permissions: () => ['permissions'] as const,
};

const ORG_LEVEL = { branchId: null } as const;
/** Reference data changes rarely. */
const REFERENCE_STALE_MS = 5 * 60_000;

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: ({ signal }) => apiClient.get<RoleDto[]>(ENDPOINTS.roles.list, { signal, ...ORG_LEVEL }),
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: ({ signal }) => apiClient.get<PermissionDto[]>(ENDPOINTS.permissions, { signal, ...ORG_LEVEL }),
    staleTime: REFERENCE_STALE_MS,
  });
}

export function useSaveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RoleInput }) =>
      id
        ? apiClient.put<RoleDto>(ENDPOINTS.roles.one(id), input, ORG_LEVEL)
        : apiClient.post<RoleDto>(ENDPOINTS.roles.list, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.roles.one(id), ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
