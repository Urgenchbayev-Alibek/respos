import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { MenuCategoryDto, MenuCategoryInput, ModifierGroupDto, ModifierGroupInput, PosCategoryDto } from './menu.types';

/** Menu catalogue is org-level: no X-Branch-Id (except `/menu/pos`, which is branch-scoped). */
export const ORG_LEVEL = { branchId: null } as const;

export const menuCategoryKeys = {
  all: ['menu-categories'] as const,
  list: () => [...menuCategoryKeys.all, 'list'] as const,
};

export const modifierGroupKeys = {
  all: ['modifier-groups'] as const,
  list: () => [...modifierGroupKeys.all, 'list'] as const,
};

export const posMenuKeys = {
  all: ['menu-pos'] as const,
  menu: () => [...posMenuKeys.all, 'menu'] as const,
};

function sortCategories<T extends { sortOrder: number }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function useMenuCategories() {
  return useQuery({
    queryKey: menuCategoryKeys.list(),
    queryFn: ({ signal }) => apiClient.get<MenuCategoryDto[]>(ENDPOINTS.menu.categories, { signal, ...ORG_LEVEL }),
    select: sortCategories,
  });
}

/** Any menu change affects the POS menu, so it is invalidated as well. */
function useInvalidate(key: readonly unknown[]) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: key }), queryClient.invalidateQueries({ queryKey: posMenuKeys.all })]);
}

export function useSaveMenuCategory() {
  const invalidate = useInvalidate(menuCategoryKeys.all);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: MenuCategoryInput }) =>
      id
        ? apiClient.put<MenuCategoryDto>(ENDPOINTS.menu.category(id), input, ORG_LEVEL)
        : apiClient.post<MenuCategoryDto>(ENDPOINTS.menu.categories, input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useArchiveMenuCategory() {
  const invalidate = useInvalidate(menuCategoryKeys.all);
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.menu.category(id), ORG_LEVEL),
    onSuccess: invalidate,
  });
}

/** Optimistic reorder: the list moves immediately and rolls back on error. */
export function useReorderMenuCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.put<MenuCategoryDto[]>(ENDPOINTS.menu.categoriesReorder, { ids }, ORG_LEVEL),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: menuCategoryKeys.list() });
      const previous = queryClient.getQueryData<MenuCategoryDto[]>(menuCategoryKeys.list());
      if (previous) {
        const byId = new Map(previous.map((category) => [category.id, category]));
        const next = ids.flatMap((id, index) => {
          const category = byId.get(id);
          return category ? [{ ...category, sortOrder: index + 1 }] : [];
        });
        queryClient.setQueryData(menuCategoryKeys.list(), next);
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(menuCategoryKeys.list(), context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: menuCategoryKeys.all }),
        queryClient.invalidateQueries({ queryKey: posMenuKeys.all }),
      ]),
  });
}

export function useModifierGroups() {
  return useQuery({
    queryKey: modifierGroupKeys.list(),
    queryFn: ({ signal }) => apiClient.get<ModifierGroupDto[]>(ENDPOINTS.menu.modifierGroups, { signal, ...ORG_LEVEL }),
  });
}

export function useSaveModifierGroup() {
  const invalidate = useInvalidate(modifierGroupKeys.all);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ModifierGroupInput }) =>
      id
        ? apiClient.put<ModifierGroupDto>(ENDPOINTS.menu.modifierGroup(id), input, ORG_LEVEL)
        : apiClient.post<ModifierGroupDto>(ENDPOINTS.menu.modifierGroups, input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useDeleteModifierGroup() {
  const invalidate = useInvalidate(modifierGroupKeys.all);
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.menu.modifierGroup(id), ORG_LEVEL),
    onSuccess: invalidate,
  });
}

/** Waiter POS menu (branch-scoped single call, plain `PosCategoryDto[]` already sorted by sortOrder). */
export function usePosMenu() {
  return useQuery({
    queryKey: posMenuKeys.menu(),
    queryFn: ({ signal }) => apiClient.get<PosCategoryDto[]>(ENDPOINTS.menu.pos, { signal }),
    select: sortCategories,
    staleTime: 60_000,
  });
}
