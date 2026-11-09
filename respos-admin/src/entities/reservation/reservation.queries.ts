import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tableKeys } from '@/entities/table/table.queries';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type { ReservationAction, ReservationDto, ReservationInput, ReservationListParams } from './reservation.types';

export const reservationKeys = {
  all: ['reservations'] as const,
  list: (params: ReservationListParams) => [...reservationKeys.all, 'list', params] as const,
};

export function useReservations(params: ReservationListParams) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<ReservationDto>>(ENDPOINTS.reservations.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Reservations change table state (reserved/occupied/nextReservation) → refresh both. */
function useInvalidateReservations() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
      queryClient.invalidateQueries({ queryKey: tableKeys.all }),
    ]);
}

export function useSaveReservation() {
  const invalidate = useInvalidateReservations();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ReservationInput }) =>
      id
        ? apiClient.put<ReservationDto>(ENDPOINTS.reservations.one(id), input)
        : apiClient.post<ReservationDto>(ENDPOINTS.reservations.list, input),
    onSuccess: invalidate,
  });
}

export function useReservationAction() {
  const invalidate = useInvalidateReservations();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: ReservationAction; reason?: string }) =>
      apiClient.post<ReservationDto>(
        ENDPOINTS.reservations.action(id, action),
        action === 'cancel' ? { reason: reason || undefined } : undefined,
      ),
    onSuccess: invalidate,
  });
}
