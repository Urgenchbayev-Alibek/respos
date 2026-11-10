import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STAFF_ENDPOINTS as E } from '@/entities/staff/staff.endpoints';
import { staffKeys } from '@/entities/staff/staff.queries';
import type { CurrentDeviceDto, DeviceDto, DeviceStaffDto } from '@/entities/staff/staff.types';
import { isApiError } from '@/shared/api/api-error';
import { apiClient } from '@/shared/api/api-client';
import { safeStorage } from '@/shared/lib/safe-storage';

/**
 * UX hint only: "this browser is a shared device" (shows the lock screen / switch-user button without a request).
 * The real credential is the httpOnly cookie `device_token`; the server decides (ADR-0014).
 */
const FLAG_KEY = 'respos.sharedDevice';

export const sharedDeviceFlag = {
  isSet: (): boolean => safeStorage.get(FLAG_KEY) === '1',
  set: (): void => safeStorage.set(FLAG_KEY, '1'),
  clear: (): void => safeStorage.remove(FLAG_KEY),
};

const DEVICE = { skipAuth: true, branchId: null } as const;

export const deviceKeys = {
  current: ['shared-device', 'current'] as const,
  staff: ['shared-device', 'staff'] as const,
};

/** `GET /auth/device` → device, or `null` when this browser is not (or no longer) a registered device. */
export function useCurrentDevice() {
  return useQuery({
    queryKey: deviceKeys.current,
    queryFn: async ({ signal }) => {
      try {
        return await apiClient.get<CurrentDeviceDto>(E.auth.device, { ...DEVICE, signal });
      } catch (error) {
        if (isApiError(error) && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
  });
}

export function useDeviceStaff(enabled: boolean) {
  return useQuery({
    queryKey: deviceKeys.staff,
    queryFn: ({ signal }) => apiClient.get<DeviceStaffDto[]>(E.auth.deviceStaff, { ...DEVICE, signal }),
    enabled,
  });
}

/** Manager turns this browser into a shared device of the current branch (sets the httpOnly cookie). */
export function useRegisterDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => apiClient.post<DeviceDto>(E.auth.deviceRegister, body),
    onSuccess: () => {
      sharedDeviceFlag.set();
      void queryClient.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

/** Ends shared mode on this browser (revokes the device + its PIN sessions, clears the cookie). */
export function useForgetDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<void>(E.auth.deviceForget, undefined, { branchId: null }),
    onSuccess: () => {
      sharedDeviceFlag.clear();
      void queryClient.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}
