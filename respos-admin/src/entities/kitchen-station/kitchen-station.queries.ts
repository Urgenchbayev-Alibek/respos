import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { KitchenStationDto, KitchenStationInput } from './kitchen-station.types';

export const kitchenStationKeys = {
  all: ['kitchen-stations'] as const,
  list: () => [...kitchenStationKeys.all, 'list'] as const,
};

function sortStations(stations: KitchenStationDto[]): KitchenStationDto[] {
  return [...stations].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function useKitchenStations(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: kitchenStationKeys.list(),
    queryFn: ({ signal }) => apiClient.get<KitchenStationDto[]>(ENDPOINTS.kitchenStations.list, { signal }),
    select: sortStations,
    enabled: options.enabled ?? true,
  });
}

export function useSaveKitchenStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: KitchenStationInput }) =>
      id
        ? apiClient.put<KitchenStationDto>(ENDPOINTS.kitchenStations.one(id), input)
        : apiClient.post<KitchenStationDto>(ENDPOINTS.kitchenStations.list, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kitchenStationKeys.all }),
  });
}

export function useDeleteKitchenStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(ENDPOINTS.kitchenStations.one(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kitchenStationKeys.all }),
  });
}
