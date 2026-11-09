import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { MAX_PAGE_SIZE, type PagedResult } from '@/shared/types/pagination';
import type { RecipeDto, RecipeMenuItem, SaveRecipeInput } from './recipe.types';

export const recipeKeys = {
  all: ['recipes'] as const,
  byItem: (menuItemId: string) => [...recipeKeys.all, 'by-item', menuItemId] as const,
  history: (menuItemId: string) => [...recipeKeys.all, 'history', menuItemId] as const,
  menuItems: (search: string) => [...recipeKeys.all, 'menu-items', search] as const,
};

/** Recipes and the menu are org-level. */
const ORG_LEVEL = { branchId: null } as const;

/** Active recipe versions of a menu item (one per variant). */
export function useRecipes(menuItemId: string | null) {
  return useQuery({
    queryKey: recipeKeys.byItem(menuItemId ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<RecipeDto[]>(ENDPOINTS.recipes.list, { params: { menuItemId }, signal, ...ORG_LEVEL }),
    enabled: Boolean(menuItemId),
  });
}

export function useRecipeHistory(menuItemId: string | null) {
  return useQuery({
    queryKey: recipeKeys.history(menuItemId ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<RecipeDto[]>(ENDPOINTS.recipes.history, { params: { menuItemId }, signal, ...ORG_LEVEL }),
    enabled: Boolean(menuItemId),
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveRecipeInput) => apiClient.post<RecipeDto>(ENDPOINTS.recipes.list, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}

/** Menu items for the recipe picker (non-archived, searchable). */
export function useRecipeMenuItems(search: string) {
  return useQuery({
    queryKey: recipeKeys.menuItems(search),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<RecipeMenuItem>>(ENDPOINTS.menu.items, {
        params: { page: 1, pageSize: MAX_PAGE_SIZE, sort: 'name:asc', search: search || undefined },
        signal,
        ...ORG_LEVEL,
      }),
    placeholderData: keepPreviousData,
  });
}
