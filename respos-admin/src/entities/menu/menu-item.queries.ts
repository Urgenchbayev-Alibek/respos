import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import { ORG_LEVEL, posMenuKeys } from './menu.queries';
import type { MenuItemDto, MenuItemInput, MenuItemListParams } from './menu.types';

export const menuItemKeys = {
  all: ['menu-items'] as const,
  list: (params: MenuItemListParams) => [...menuItemKeys.all, 'list', params] as const,
  detail: (id: string) => [...menuItemKeys.all, 'detail', id] as const,
};

export function useMenuItems(params: MenuItemListParams) {
  return useQuery({
    queryKey: menuItemKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<MenuItemDto>>(ENDPOINTS.menu.items, { params: { ...params }, signal, ...ORG_LEVEL }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateItems() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: menuItemKeys.all }),
      queryClient.invalidateQueries({ queryKey: posMenuKeys.all }),
    ]);
}

export function useSaveMenuItem() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: MenuItemInput }) =>
      id
        ? apiClient.put<MenuItemDto>(ENDPOINTS.menu.item(id), input, ORG_LEVEL)
        : apiClient.post<MenuItemDto>(ENDPOINTS.menu.items, input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useArchiveMenuItem() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(ENDPOINTS.menu.itemArchive(id), undefined, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

/** Stop-list toggle. */
export function useSetMenuItemAvailability() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      apiClient.post<MenuItemDto>(ENDPOINTS.menu.itemAvailability(id), { isAvailable }, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export const MENU_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const MENU_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function useUploadMenuItemPhoto() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      return apiClient.post<{ photoUrl: string }>(ENDPOINTS.menu.itemPhoto(id), body, ORG_LEVEL);
    },
    onSuccess: invalidate,
  });
}
