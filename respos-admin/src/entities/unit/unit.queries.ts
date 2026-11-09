import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { UnitConversionInput, UnitDto, UnitInput } from './unit.types';

export const unitKeys = { all: ['units'] as const };

/** Units of measure are org-level (no X-Branch-Id). */
const ORG_LEVEL = { branchId: null } as const;

export function useUnits() {
  return useQuery({
    queryKey: unitKeys.all,
    queryFn: ({ signal }) => apiClient.get<UnitDto[]>(ENDPOINTS.inventory.units, { signal, ...ORG_LEVEL }),
    staleTime: 5 * 60_000,
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnitInput) => apiClient.post<UnitDto>(ENDPOINTS.inventory.units, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitKeys.all }),
  });
}

export function useCreateUnitConversion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnitConversionInput) =>
      apiClient.post<unknown>(ENDPOINTS.inventory.unitConversions, input, ORG_LEVEL),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitKeys.all }),
  });
}

/** Options for unit selects: "kg — Килограмм". */
export function unitOptions(units: UnitDto[] | undefined) {
  return (units ?? []).map((unit) => ({ value: unit.id, label: `${unit.code} — ${unit.name}` }));
}
