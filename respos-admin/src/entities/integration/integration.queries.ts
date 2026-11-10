import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type {
  IntegrationConfigByType,
  IntegrationDto,
  IntegrationErrorDto,
  IntegrationErrorListParams,
  IntegrationTestResultDto,
  IntegrationType,
  OutboundListParams,
  OutboundMessageDto,
} from './integration.types';

export const integrationKeys = {
  all: ['integrations'] as const,
  list: () => [...integrationKeys.all, 'list'] as const,
  outbound: (params: OutboundListParams) => [...integrationKeys.all, 'outbound', params] as const,
  errors: (params: IntegrationErrorListParams) => [...integrationKeys.all, 'errors', params] as const,
  platformErrors: (params: IntegrationErrorListParams) => [...integrationKeys.all, 'platform-errors', params] as const,
};

/** Integrations are org-level: no X-Branch-Id. */
const NO_BRANCH = { branchId: null } as const;

export function useIntegrations() {
  return useQuery({
    queryKey: integrationKeys.list(),
    queryFn: ({ signal }) => apiClient.get<IntegrationDto[]>(ENDPOINTS.integrations.list, { signal, ...NO_BRANCH }),
  });
}

export interface SaveIntegrationInput<T extends IntegrationType = IntegrationType> {
  type: T;
  isEnabled: boolean;
  config: IntegrationConfigByType[T];
}

export function useSaveIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, ...body }: SaveIntegrationInput) =>
      apiClient.put<IntegrationDto>(ENDPOINTS.integrations.one(type), body, NO_BRANCH),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}

export function useTestIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, recipient }: { type: IntegrationType; recipient?: string }) =>
      apiClient.post<IntegrationTestResultDto>(ENDPOINTS.integrations.test(type), { recipient: recipient || null }, NO_BRANCH),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}

export function useOutboundMessages(params: OutboundListParams) {
  return useQuery({
    queryKey: integrationKeys.outbound(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<OutboundMessageDto>>(ENDPOINTS.integrations.outboundMessages, { params: { ...params }, signal, ...NO_BRANCH }),
    placeholderData: keepPreviousData,
  });
}

export function useIntegrationErrors(params: IntegrationErrorListParams, scope: 'organization' | 'platform' = 'organization') {
  const path = scope === 'platform' ? ENDPOINTS.platform.integrationErrors : ENDPOINTS.integrations.errors;
  return useQuery({
    queryKey: scope === 'platform' ? integrationKeys.platformErrors(params) : integrationKeys.errors(params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<IntegrationErrorDto>>(path, { params: { ...params }, signal, ...NO_BRANCH }),
    placeholderData: keepPreviousData,
  });
}
