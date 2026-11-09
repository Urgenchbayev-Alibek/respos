import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type {
  CashShiftDetailDto,
  CashShiftDto,
  CashShiftListParams,
  CloseShiftInput,
  OpenShiftInput,
} from './cash-shift.types';

export const cashShiftKeys = {
  all: ['cash-shifts'] as const,
  current: () => [...cashShiftKeys.all, 'current'] as const,
  list: (params: CashShiftListParams) => [...cashShiftKeys.all, 'list', params] as const,
  detail: (id: string) => [...cashShiftKeys.all, 'detail', id] as const,
};

/** `GET /cash-shifts/current` → CashShiftDto | 204 (no open shift → null). */
export function useCurrentShift(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: cashShiftKeys.current(),
    queryFn: async ({ signal }) =>
      (await apiClient.get<CashShiftDto | undefined>(ENDPOINTS.cashShifts.current, { signal })) ?? null,
    enabled: options.enabled ?? true,
  });
}

export function useCashShifts(params: CashShiftListParams) {
  return useQuery({
    queryKey: cashShiftKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<CashShiftDto>>(ENDPOINTS.cashShifts.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCashShift(id: string | null) {
  return useQuery({
    queryKey: cashShiftKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiClient.get<CashShiftDetailDto>(ENDPOINTS.cashShifts.one(id ?? ''), { signal }),
    enabled: Boolean(id),
  });
}

function useInvalidateShifts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: cashShiftKeys.all });
}

export function useOpenShift() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (input: OpenShiftInput) => apiClient.post<CashShiftDto>(ENDPOINTS.cashShifts.open, input),
    onSuccess: invalidate,
  });
}

export function useCloseShift() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CloseShiftInput }) =>
      apiClient.post<CashShiftDto>(ENDPOINTS.cashShifts.close(id), input),
    onSuccess: invalidate,
  });
}
