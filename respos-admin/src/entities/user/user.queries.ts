import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { PagedResult } from '@/shared/types/pagination';
import type {
  CreateUserInput,
  InvitationResult,
  InviteUserInput,
  UpdateUserInput,
  UserAction,
  UserDto,
  UserListParams,
} from './user.types';

export const userKeys = {
  all: ['users'] as const,
  list: (params: UserListParams) => [...userKeys.all, 'list', params] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

/** Users are org-level (branch filter goes as `branchId` query param, not header). */
const ORG_LEVEL = { branchId: null } as const;

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<UserDto>>(ENDPOINTS.users.list, { params: { ...params }, signal, ...ORG_LEVEL }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateUserInput) => apiClient.post<UserDto>(ENDPOINTS.users.list, input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useInviteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: InviteUserInput) => apiClient.post<InvitationResult>(ENDPOINTS.users.invitations, input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      apiClient.put<UserDto>(ENDPOINTS.users.one(id), input, ORG_LEVEL),
    onSuccess: invalidate,
  });
}

export function useUserAction() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: UserAction }) =>
      apiClient.post<UserDto>(ENDPOINTS.users.action(id, action), undefined, ORG_LEVEL),
    onSuccess: invalidate,
  });
}
