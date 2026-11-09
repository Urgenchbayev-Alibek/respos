import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { AuthResponse } from '@/shared/types/api-response';

/** Public auth flows (no session): never send a branch header. */
const PUBLIC = { skipAuth: true, branchId: null } as const;

/** `202 Accepted`, empty body (never reveals whether the account exists). */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) => apiClient.post<void>(ENDPOINTS.auth.forgotPassword, body, PUBLIC),
  });
}

/** `204`. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      apiClient.post<void>(ENDPOINTS.auth.resetPassword, body, PUBLIC),
  });
}

/** `200 AuthResponse` + refresh cookie (the invitee is signed in; the page still offers the login link). */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (body: { token: string; fullName: string; password: string }) =>
      apiClient.post<AuthResponse>(ENDPOINTS.auth.acceptInvitation, body, PUBLIC),
  });
}

/** `204`; other sessions are revoked server-side, the current refresh cookie stays valid. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiClient.post<void>(ENDPOINTS.auth.changePassword, body, { branchId: null }),
  });
}
