import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kitchenStationKeys } from '@/entities/kitchen-station/kitchen-station.queries';
import type { KitchenStationDto } from '@/entities/kitchen-station/kitchen-station.types';
import { ORG_LEVEL, posMenuKeys } from '@/entities/menu/menu.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { BranchMenuItemDto, BranchMenuItemInput } from './branch-menu.types';

export const branchMenuKeys = {
  all: ['branch-menu'] as const,
  item: (menuItemId: string) => [...branchMenuKeys.all, 'item', menuItemId] as const,
};

/** Org-level matrix: one row per active branch. */
export function useBranchMenuItems(menuItemId: string | undefined) {
  return useQuery({
    queryKey: branchMenuKeys.item(menuItemId ?? ''),
    queryFn: ({ signal }) => apiClient.get<BranchMenuItemDto[]>(ENDPOINTS.menu.itemBranches(menuItemId ?? ''), { signal, ...ORG_LEVEL }),
    enabled: Boolean(menuItemId),
  });
}

/** Kitchen stations of an explicit branch (the station override must belong to that branch). */
export function useBranchStations(branchId: string | undefined) {
  return useQuery({
    queryKey: [...kitchenStationKeys.all, 'branch', branchId ?? ''] as const,
    queryFn: ({ signal }) =>
      apiClient.get<KitchenStationDto[]>(ENDPOINTS.kitchenStations.list, {
        signal,
        branchId: branchId ?? null,
      }),
    enabled: Boolean(branchId),
  });
}

function useInvalidateBranchMenu() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: branchMenuKeys.all }),
      queryClient.invalidateQueries({ queryKey: posMenuKeys.all }),
    ]);
}

export function useSaveBranchMenuItem() {
  const invalidate = useInvalidateBranchMenu();
  return useMutation({
    mutationFn: ({ menuItemId, branchId, input }: { menuItemId: string; branchId: string; input: BranchMenuItemInput }) =>
      apiClient.put<BranchMenuItemDto>(ENDPOINTS.menu.itemBranch(menuItemId, branchId), input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useResetBranchMenuItem() {
  const invalidate = useInvalidateBranchMenu();
  return useMutation({
    mutationFn: ({ menuItemId, branchId }: { menuItemId: string; branchId: string }) =>
      apiClient.delete(ENDPOINTS.menu.itemBranch(menuItemId, branchId), ORG_LEVEL),
    onSuccess: invalidate,
  });
}

/** Stop-list toggle for the CURRENT branch (X-Branch-Id). */
export function useSetBranchAvailability() {
  const invalidate = useInvalidateBranchMenu();
  return useMutation({
    mutationFn: ({ menuItemId, isAvailable }: { menuItemId: string; isAvailable: boolean }) =>
      apiClient.put<BranchMenuItemDto>(ENDPOINTS.menu.branchAvailability(menuItemId), { isAvailable }),
    onSuccess: invalidate,
  });
}
