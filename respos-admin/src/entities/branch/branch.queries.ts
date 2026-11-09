import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { BranchDto, BranchInput, BranchSettingsDto } from './branch.types';

/** Query keys: `[entity, scope, params]` — invalidate with `branchKeys.all`. */
export const branchKeys = {
  all: ['branches'] as const,
  list: () => [...branchKeys.all, 'list'] as const,
  settings: (branchId: string) => [...branchKeys.all, 'settings', branchId] as const,
};

/** Branch management is org-level: do not send X-Branch-Id. */
const ORG_LEVEL = { branchId: null } as const;

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.list(),
    queryFn: ({ signal }) => apiClient.get<BranchDto[]>(ENDPOINTS.branches.list, { signal, ...ORG_LEVEL }),
  });
}

export function useSaveBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BranchInput }) =>
      id
        ? apiClient.put<BranchDto>(ENDPOINTS.branches.one(id), input, ORG_LEVEL)
        : apiClient.post<BranchDto>(ENDPOINTS.branches.list, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useDeactivateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<BranchDto>(ENDPOINTS.branches.deactivate(id), undefined, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useBranchSettings(branchId: string) {
  return useQuery({
    queryKey: branchKeys.settings(branchId),
    queryFn: ({ signal }) => apiClient.get<BranchSettingsDto>(ENDPOINTS.branches.settings(branchId), { signal, ...ORG_LEVEL }),
    enabled: Boolean(branchId),
  });
}

export function useSaveBranchSettings(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchSettingsDto) =>
      apiClient.put<BranchSettingsDto>(ENDPOINTS.branches.settings(branchId), input, ORG_LEVEL),
    onSuccess: (data) => queryClient.setQueryData(branchKeys.settings(branchId), data),
  });
}
