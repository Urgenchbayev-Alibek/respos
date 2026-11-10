import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { WaiterCallDto } from './waiter-call.types';

export const waiterCallKeys = {
  all: ['waiter-calls'] as const,
  active: () => [...waiterCallKeys.all, 'active'] as const,
};

export function useWaiterCalls() {
  return useQuery({
    queryKey: waiterCallKeys.active(),
    queryFn: ({ signal }) => apiClient.get<WaiterCallDto[]>(ENDPOINTS.waiterCalls.list, { signal }),
  });
}

export function useAcknowledgeWaiterCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => apiClient.post<WaiterCallDto>(ENDPOINTS.waiterCalls.acknowledge(callId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: waiterCallKeys.all }),
  });
}
