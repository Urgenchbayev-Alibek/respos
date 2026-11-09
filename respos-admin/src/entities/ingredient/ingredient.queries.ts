import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { MAX_PAGE_SIZE, type PagedResult } from '@/shared/types/pagination';
import type { IngredientCategoryDto, IngredientDto, IngredientInput, IngredientListParams } from './ingredient.types';

export const ingredientKeys = {
  all: ['ingredients'] as const,
  list: (params: IngredientListParams) => [...ingredientKeys.all, 'list', params] as const,
};

export const ingredientCategoryKeys = { all: ['ingredient-categories'] as const };

export function useIngredients(params: IngredientListParams, enabled = true) {
  return useQuery({
    queryKey: ingredientKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<IngredientDto>>(ENDPOINTS.inventory.ingredients, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Up to 100 ingredients for pickers (recipes, purchases, movements). */
export function useIngredientOptions(enabled = true) {
  return useIngredients({ page: 1, pageSize: MAX_PAGE_SIZE, sort: 'name:asc' }, enabled);
}

function useInvalidate(keys: readonly (readonly string[])[]) {
  const queryClient = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useSaveIngredient() {
  const invalidate = useInvalidate([ingredientKeys.all]);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: IngredientInput }) =>
      id
        ? apiClient.put<IngredientDto>(ENDPOINTS.inventory.ingredient(id), input)
        : apiClient.post<IngredientDto>(ENDPOINTS.inventory.ingredients, input),
    onSuccess: invalidate,
  });
}

export function useArchiveIngredient() {
  const invalidate = useInvalidate([ingredientKeys.all]);
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(ENDPOINTS.inventory.ingredientArchive(id)),
    onSuccess: invalidate,
  });
}

export function useSetMinQuantity() {
  const invalidate = useInvalidate([ingredientKeys.all, ['reports']]);
  return useMutation({
    mutationFn: ({ id, minQuantity }: { id: string; minQuantity: number }) =>
      apiClient.put<IngredientDto>(ENDPOINTS.inventory.ingredientMinQuantity(id), { minQuantity }),
    onSuccess: invalidate,
  });
}

export function useIngredientCategories() {
  return useQuery({
    queryKey: ingredientCategoryKeys.all,
    queryFn: ({ signal }) => apiClient.get<IngredientCategoryDto[]>(ENDPOINTS.inventory.ingredientCategories, { signal }),
  });
}

export function useSaveIngredientCategory() {
  const invalidate = useInvalidate([ingredientCategoryKeys.all, ingredientKeys.all]);
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      id
        ? apiClient.put<IngredientCategoryDto>(ENDPOINTS.inventory.ingredientCategory(id), { name })
        : apiClient.post<IngredientCategoryDto>(ENDPOINTS.inventory.ingredientCategories, { name }),
    onSuccess: invalidate,
  });
}

export function useDeleteIngredientCategory() {
  const invalidate = useInvalidate([ingredientCategoryKeys.all, ingredientKeys.all]);
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.inventory.ingredientCategory(id)),
    onSuccess: invalidate,
  });
}
