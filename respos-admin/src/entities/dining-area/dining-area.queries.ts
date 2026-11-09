import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { DiningAreaDto, DiningAreaInput } from './dining-area.types';

export const diningAreaKeys = {
  all: ['dining-areas'] as const,
  list: () => [...diningAreaKeys.all, 'list'] as const,
};

function sortAreas(areas: DiningAreaDto[]): DiningAreaDto[] {
  return [...areas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Small reference list (plain array), sorted by SortOrder for tabs. */
export function useDiningAreas() {
  return useQuery({
    queryKey: diningAreaKeys.list(),
    queryFn: ({ signal }) => apiClient.get<DiningAreaDto[]>(ENDPOINTS.diningAreas.list, { signal }),
    select: sortAreas,
  });
}

export function useSaveDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DiningAreaInput }) =>
      id
        ? apiClient.put<DiningAreaDto>(ENDPOINTS.diningAreas.one(id), input)
        : apiClient.post<DiningAreaDto>(ENDPOINTS.diningAreas.list, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diningAreaKeys.all }),
  });
}

export function useArchiveDiningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.diningAreas.one(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diningAreaKeys.all }),
  });
}
