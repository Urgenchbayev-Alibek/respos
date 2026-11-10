import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseKeys } from '@/entities/purchase/purchase.queries';
import type { PurchaseDto } from '@/entities/purchase/purchase.types';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { ApplySuggestionsInput, PurchaseSuggestionParams, PurchaseSuggestionsDto } from './purchase-suggestion.types';

export const suggestionKeys = {
  all: ['purchase-suggestions'] as const,
  list: (params: PurchaseSuggestionParams) => [...suggestionKeys.all, params] as const,
};

export function usePurchaseSuggestions(params: PurchaseSuggestionParams, enabled = true) {
  return useQuery({
    queryKey: suggestionKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PurchaseSuggestionsDto>(ENDPOINTS.purchases.suggestions, {
        params: { ...params },
        signal,
      }),
    enabled,
  });
}

/** Creates one draft purchase order per supplier. */
export function useApplySuggestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplySuggestionsInput) => apiClient.post<PurchaseDto[]>(ENDPOINTS.purchases.suggestionsApply, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: purchaseKeys.all }),
        queryClient.invalidateQueries({ queryKey: suggestionKeys.all }),
      ]),
  });
}
