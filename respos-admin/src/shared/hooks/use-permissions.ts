import { useMemo } from 'react';
import { isPlatformPermission, type Permission } from '@/shared/constants/permissions';
import type { MeDto } from '@/shared/types/api-response';
import { useAuth } from './use-auth';

type PermissionSubject = Pick<MeDto, 'permissions' | 'isPlatformAdmin'> | null | undefined;

/**
 * THE permission check (UX only — the backend enforces).
 * Platform permissions are granted to platform admins even if the token has no org permissions.
 */
export function hasPermission(user: PermissionSubject, code: Permission): boolean {
  if (!user) return false;
  if (user.permissions.includes(code)) return true;
  return isPlatformPermission(code) && user.isPlatformAdmin;
}

export function hasAnyPermission(user: PermissionSubject, codes: readonly Permission[]): boolean {
  return codes.length === 0 || codes.some((code) => hasPermission(user, code));
}

export function hasAllPermissions(user: PermissionSubject, codes: readonly Permission[]): boolean {
  return codes.every((code) => hasPermission(user, code));
}

export interface PermissionsApi {
  hasPermission: (code: Permission) => boolean;
  hasAny: (codes: readonly Permission[]) => boolean;
  hasAll: (codes: readonly Permission[]) => boolean;
  isPlatformAdmin: boolean;
}

export function usePermissions(): PermissionsApi {
  const { user } = useAuth();
  return useMemo(
    () => ({
      hasPermission: (code) => hasPermission(user, code),
      hasAny: (codes) => hasAnyPermission(user, codes),
      hasAll: (codes) => hasAllPermissions(user, codes),
      isPlatformAdmin: Boolean(user?.isPlatformAdmin),
    }),
    [user],
  );
}
