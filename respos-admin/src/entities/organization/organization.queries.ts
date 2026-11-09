import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { Language } from '@/shared/constants/locale';
import type { OrganizationStatus } from '@/shared/constants/statuses';
import type { Guid } from '@/shared/types/api-response';

export interface OrganizationDto {
  id: Guid;
  name: string;
  slug: string;
  currency: string;
  defaultLanguage: Language;
  status: OrganizationStatus;
  isDemo: boolean;
}

export interface OrganizationInput {
  name: string;
  currency: string;
  defaultLanguage: Language;
}

export const organizationKeys = { current: ['organization'] as const };

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.current,
    queryFn: ({ signal }) => apiClient.get<OrganizationDto>(ENDPOINTS.organization, { signal, branchId: null }),
  });
}

export function useSaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      apiClient.put<OrganizationDto>(ENDPOINTS.organization, input, { branchId: null }),
    onSuccess: (data) => queryClient.setQueryData(organizationKeys.current, data),
  });
}
