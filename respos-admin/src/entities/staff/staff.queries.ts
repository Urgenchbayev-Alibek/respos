import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from '@/entities/report/analytics.queries';
import { apiClient } from '@/shared/api/api-client';
import type { PagedResult } from '@/shared/types/pagination';
import { STAFF_ENDPOINTS as E } from './staff.endpoints';
import type {
  DeviceDto,
  MyTimeClockDto,
  PinStatusDto,
  ShiftDto,
  ShiftInput,
  StaffMemberDto,
  TimeEntryDto,
  TimeEntryInput,
  TimeEntryListParams,
  TimesheetDto,
} from './staff.types';

export interface DateRange {
  from: string;
  to: string;
}

export const staffKeys = {
  all: ['staff'] as const,
  timeClock: () => [...staffKeys.all, 'time-clock'] as const,
  entries: (params: TimeEntryListParams) => [...staffKeys.all, 'entries', params] as const,
  timesheet: (range: DateRange & { userId?: string }) => [...staffKeys.all, 'timesheet', range] as const,
  schedule: (range: DateRange) => [...staffKeys.all, 'schedule', range] as const,
  mySchedule: (range: DateRange) => [...staffKeys.all, 'my-schedule', range] as const,
  members: () => [...staffKeys.all, 'members'] as const,
  devices: (includeRevoked: boolean) => [...staffKeys.all, 'devices', includeRevoked] as const,
  myPin: () => [...staffKeys.all, 'my-pin'] as const,
};

function useInvalidateStaff() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: staffKeys.all });
}

export function useMyTimeClock(enabled = true) {
  return useQuery({
    queryKey: staffKeys.timeClock(),
    queryFn: ({ signal }) => apiClient.get<MyTimeClockDto>(E.timeClock.me, { signal }),
    enabled,
  });
}

export function useClockIn() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (body: { note?: string | null }) => apiClient.post<TimeEntryDto>(E.timeClock.clockIn, body),
    onSuccess: invalidate,
  });
}

export function useClockOut() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (body: { breakMinutes?: number | null; note?: string | null }) =>
      apiClient.post<TimeEntryDto>(E.timeClock.clockOut, body),
    onSuccess: invalidate,
  });
}

export function useTimeEntries(params: TimeEntryListParams) {
  return useQuery({
    queryKey: staffKeys.entries(params),
    queryFn: ({ signal }) => apiClient.get<PagedResult<TimeEntryDto>>(E.timeEntries.list, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveTimeEntry() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ id, userId, ...body }: TimeEntryInput & { id?: string; userId?: string }) =>
      id ? apiClient.put<TimeEntryDto>(E.timeEntries.one(id), body) : apiClient.post<TimeEntryDto>(E.timeEntries.list, { ...body, userId }),
    onSuccess: invalidate,
  });
}

export function useTimesheet(range: DateRange & { userId?: string }, enabled = true) {
  return useQuery({
    queryKey: staffKeys.timesheet(range),
    queryFn: ({ signal }) => apiClient.get<TimesheetDto>(E.timesheet.report, { params: { ...range }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useExportTimesheet() {
  return useMutation({
    mutationFn: async (range: DateRange) => {
      const csv = await apiClient.get<string>(E.timesheet.export, { params: { ...range }, headers: { Accept: 'text/csv' } });
      // response.text() drops the server's BOM; restore it so Excel reads Cyrillic correctly.
      saveBlob(new Blob(['﻿', csv ?? ''], { type: 'text/csv;charset=utf-8' }), `timesheet_${range.from}_${range.to}.csv`);
    },
  });
}

export function useSchedule(range: DateRange) {
  return useQuery({
    queryKey: staffKeys.schedule(range),
    queryFn: ({ signal }) => apiClient.get<ShiftDto[]>(E.schedule.list, { params: { ...range }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useMySchedule(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: staffKeys.mySchedule(range),
    queryFn: ({ signal }) => apiClient.get<ShiftDto[]>(E.schedule.my, { params: { ...range }, signal }),
    enabled,
  });
}

export function useSaveShift() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ id, ...body }: ShiftInput & { id?: string }) =>
      id ? apiClient.put<ShiftDto>(E.schedule.one(id), body) : apiClient.post<ShiftDto>(E.schedule.list, body),
    onSuccess: invalidate,
  });
}

export function useDeleteShift() {
  const invalidate = useInvalidateStaff();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(E.schedule.one(id)), onSuccess: invalidate });
}

export function useStaffMembers() {
  return useQuery({
    queryKey: staffKeys.members(),
    queryFn: ({ signal }) => apiClient.get<StaffMemberDto[]>(E.members.list, { signal }),
  });
}

export function useSetMemberPin() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ userId, pin }: { userId: string; pin: string }) => apiClient.put<PinStatusDto>(E.members.pin(userId), { pin }),
    onSuccess: invalidate,
  });
}

export function useResetMemberPin() {
  const invalidate = useInvalidateStaff();
  return useMutation({ mutationFn: (userId: string) => apiClient.delete(E.members.pin(userId)), onSuccess: invalidate });
}

export function useDevices(includeRevoked: boolean) {
  return useQuery({
    queryKey: staffKeys.devices(includeRevoked),
    queryFn: ({ signal }) => apiClient.get<DeviceDto[]>(E.devices.list, { params: { includeRevoked }, signal }),
  });
}

export function useRevokeDevice() {
  const invalidate = useInvalidateStaff();
  return useMutation({ mutationFn: (id: string) => apiClient.post<DeviceDto>(E.devices.revoke(id)), onSuccess: invalidate });
}

/** Own PIN (org-level endpoint: no branch header). */
export function useMyPin() {
  return useQuery({
    queryKey: staffKeys.myPin(),
    queryFn: ({ signal }) => apiClient.get<PinStatusDto>(E.auth.pin, { signal, branchId: null }),
  });
}

export function useSetMyPin() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (body: { currentPassword: string; pin: string }) => apiClient.put<PinStatusDto>(E.auth.pin, body, { branchId: null }),
    onSuccess: invalidate,
  });
}

export function useRemoveMyPin() {
  const invalidate = useInvalidateStaff();
  return useMutation({ mutationFn: () => apiClient.delete(E.auth.pin, { branchId: null }), onSuccess: invalidate });
}
