import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type {
  KitchenStationDto,
  KitchenTicketDto,
  KitchenTicketParams,
  TicketAction,
  TicketItemAction,
} from './kitchen-ticket.types';

export const kitchenTicketKeys = {
  all: ['kitchen-tickets'] as const,
  list: (params: KitchenTicketParams) => [...kitchenTicketKeys.all, 'list', params] as const,
};

export const kitchenStationKeys = {
  all: ['kitchen-stations'] as const,
  list: () => [...kitchenStationKeys.all, 'list'] as const,
};

/** Fallback polling while the realtime connection is down (events are hints; REST is the truth). */
const OFFLINE_POLL_MS = 30_000;

export function useKitchenStations() {
  return useQuery({
    queryKey: kitchenStationKeys.list(),
    queryFn: ({ signal }) => apiClient.get<KitchenStationDto[]>(ENDPOINTS.kitchenStations.list, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useKitchenTickets(params: KitchenTicketParams, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: kitchenTicketKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<KitchenTicketDto[]>(ENDPOINTS.kitchen.tickets, {
        params: { stationId: params.stationId, status: params.status },
        signal,
      }),
    refetchInterval: options.poll ? OFFLINE_POLL_MS : false,
  });
}

function useInvalidateTickets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: kitchenTicketKeys.all });
}

export function useTicketAction() {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: ({ ticketId, action }: { ticketId: string; action: TicketAction }) =>
      apiClient.post<KitchenTicketDto>(ENDPOINTS.kitchen.ticketAction(ticketId, action)),
    onSettled: invalidate,
  });
}

export function useTicketItemAction() {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: ({ itemId, action }: { itemId: string; action: TicketItemAction }) =>
      apiClient.post<KitchenTicketDto>(ENDPOINTS.kitchen.ticketItemAction(itemId, action)),
    onSettled: invalidate,
  });
}
