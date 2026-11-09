import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { DemoRequestStatus } from '@/shared/constants/statuses';
import type { PagedResult, PageParams } from '@/shared/types/pagination';
import type {
  CreateOrganizationInput,
  DemoRequestDto,
  DemoRequestListParams,
  FeatureDto,
  FeatureFlagDto,
  PlanDto,
  PlanInput,
  PlatformOrganizationDto,
  PlatformOrganizationListParams,
  SubscriptionInput,
  SystemEventDto,
  SystemStatusDto,
  TenantAccessDto,
} from './platform.types';

export const platformKeys = {
  all: ['platform'] as const,
  organizations: (params: PlatformOrganizationListParams) => [...platformKeys.all, 'organizations', params] as const,
  plans: () => [...platformKeys.all, 'plans'] as const,
  features: () => [...platformKeys.all, 'features'] as const,
  featureFlags: (organizationId: string | null) => [...platformKeys.all, 'feature-flags', organizationId ?? 'global'] as const,
  system: () => [...platformKeys.all, 'system'] as const,
  systemEvents: (params: PageParams) => [...platformKeys.all, 'system-events', params] as const,
  demoRequests: (params: DemoRequestListParams) => [...platformKeys.all, 'demo-requests', params] as const,
};

/** Platform endpoints have no branch (token may have no org). */
const NO_BRANCH = { branchId: null } as const;
const SYSTEM_REFRESH_MS = 30_000;

function usePaged<T>(key: readonly unknown[], path: string, params: PageParams) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiClient.get<PagedResult<T>>(path, { params: { ...params }, signal, ...NO_BRANCH }),
    placeholderData: keepPreviousData,
  });
}

export const usePlatformOrganizations = (params: PlatformOrganizationListParams) =>
  usePaged<PlatformOrganizationDto>(platformKeys.organizations(params), ENDPOINTS.platform.organizations, params);
export const useSystemEvents = (params: PageParams) =>
  usePaged<SystemEventDto>(platformKeys.systemEvents(params), ENDPOINTS.platform.systemEvents, params);
export const useDemoRequests = (params: DemoRequestListParams) =>
  usePaged<DemoRequestDto>(platformKeys.demoRequests(params), ENDPOINTS.platform.demoRequests, params);

export function usePlans(enabled = true) {
  return useQuery({
    queryKey: platformKeys.plans(),
    queryFn: ({ signal }) => apiClient.get<PlanDto[]>(ENDPOINTS.platform.plans, { signal, ...NO_BRANCH }),
    enabled,
  });
}

export function useFeatures(enabled = true) {
  return useQuery({
    queryKey: platformKeys.features(),
    queryFn: ({ signal }) => apiClient.get<FeatureDto[]>(ENDPOINTS.platform.features, { signal, ...NO_BRANCH }),
    enabled,
  });
}

export function useFeatureFlags(organizationId: string | null) {
  return useQuery({
    queryKey: platformKeys.featureFlags(organizationId),
    queryFn: ({ signal }) =>
      apiClient.get<FeatureFlagDto[]>(ENDPOINTS.platform.featureFlags, {
        params: { organizationId: organizationId ?? undefined },
        signal,
        ...NO_BRANCH,
      }),
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: platformKeys.system(),
    queryFn: ({ signal }) => apiClient.get<SystemStatusDto>(ENDPOINTS.platform.system, { signal, ...NO_BRANCH }),
    refetchInterval: SYSTEM_REFRESH_MS,
  });
}

function usePlatformMutation<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.all }),
  });
}

export const useCreateOrganization = () =>
  usePlatformMutation((input: CreateOrganizationInput) =>
    apiClient.post<PlatformOrganizationDto>(ENDPOINTS.platform.organizations, input, NO_BRANCH),
  );

export const useOrganizationStatus = () =>
  usePlatformMutation(({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
    apiClient.post<PlatformOrganizationDto>(ENDPOINTS.platform.organizationAction(id, action), undefined, NO_BRANCH),
  );

export const useUpdateSubscription = () =>
  usePlatformMutation(({ id, input }: { id: string; input: SubscriptionInput }) =>
    apiClient.put<unknown>(ENDPOINTS.platform.organizationAction(id, 'subscription'), input, NO_BRANCH),
  );

export const useSavePlan = () =>
  usePlatformMutation(({ id, input }: { id?: string; input: PlanInput }) =>
    id
      ? apiClient.put<PlanDto>(ENDPOINTS.platform.plan(id), input, NO_BRANCH)
      : apiClient.post<PlanDto>(ENDPOINTS.platform.plans, input, NO_BRANCH),
  );

export const useSetFeatureFlag = () =>
  usePlatformMutation((input: FeatureFlagDto) => apiClient.put<unknown>(ENDPOINTS.platform.featureFlags, input, NO_BRANCH));

export const useSetDemoRequestStatus = () =>
  usePlatformMutation(({ id, status }: { id: string; status: DemoRequestStatus }) =>
    apiClient.post<DemoRequestDto>(ENDPOINTS.platform.demoRequestStatus(id), { status }, NO_BRANCH),
  );

/** Break-glass access: audited server-side with the mandatory reason. */
export function useTenantAccess() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<TenantAccessDto>(ENDPOINTS.platform.organizationAction(id, 'access'), { reason }, NO_BRANCH),
  });
}
