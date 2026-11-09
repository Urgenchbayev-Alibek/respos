import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';

/** Public auth flows (no session): never send a branch header. */
const PUBLIC = { skipAuth: true, branchId: null } as const;

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) => apiClient.post<void>(ENDPOINTS.auth.forgotPassword, body, PUBLIC),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      apiClient.post<void>(ENDPOINTS.auth.resetPassword, body, PUBLIC),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (body: { token: string; fullName: string; password: string }) =>
      apiClient.post<void>(ENDPOINTS.auth.acceptInvitation, body, PUBLIC),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiClient.post<void>(ENDPOINTS.auth.changePassword, body, { branchId: null }),
  });
}
