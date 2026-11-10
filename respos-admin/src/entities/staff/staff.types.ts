import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** respos-contracts/v2/F6-staff.md */
export type TimeEntrySource = 'self' | 'manager';

export interface TimeEntryDto {
  id: Guid;
  userId: Guid;
  userName: string | null;
  branchId: Guid;
  clockInAt: Iso8601;
  clockOutAt: Iso8601 | null;
  breakMinutes: number;
  workedMinutes: number;
  isOpen: boolean;
  source: TimeEntrySource;
  note: string | null;
  editedBy: Guid | null;
  editedByName: string | null;
  editedAt: Iso8601 | null;
  editReason: string | null;
}

export interface MyTimeClockDto {
  openEntry: TimeEntryDto | null;
  todayWorkedMinutes: number;
}

export interface TimeEntryListParams {
  page: number;
  pageSize: number;
  userId?: Guid;
  from?: string;
  to?: string;
  openOnly?: boolean;
}

export interface TimeEntryInput {
  clockInAt: Iso8601;
  clockOutAt: Iso8601 | null;
  breakMinutes: number;
  note: string | null;
  reason: string;
}

export interface TimesheetDayDto {
  date: string;
  workedMinutes: number;
  plannedMinutes: number;
}

export interface TimesheetRowDto {
  userId: Guid;
  fullName: string | null;
  workedMinutes: number;
  plannedMinutes: number;
  entries: number;
  hasOpenEntry: boolean;
  days: TimesheetDayDto[];
}

export interface TimesheetDto {
  from: string;
  to: string;
  rows: TimesheetRowDto[];
  totalWorkedMinutes: number;
  totalPlannedMinutes: number;
}

export interface ShiftDto {
  id: Guid;
  userId: Guid;
  userName: string | null;
  branchId: Guid;
  date: string;
  /** Local branch time `HH:mm`; end ≤ start = overnight. */
  startTime: string;
  endTime: string;
  plannedMinutes: number;
  roleNote: string | null;
  note: string | null;
}

export interface ShiftInput {
  userId: Guid;
  date: string;
  startTime: string;
  endTime: string;
  roleNote: string | null;
  note: string | null;
}

export interface StaffMemberDto {
  userId: Guid;
  fullName: string;
  email: string;
  roles: string[];
  hasPin: boolean;
  pinAllowed: boolean;
  pinLockedUntil: Iso8601 | null;
}

export interface PinStatusDto {
  hasPin: boolean;
  allowed: boolean;
  updatedAt: Iso8601 | null;
  lockedUntil: Iso8601 | null;
}

export interface DeviceDto {
  id: Guid;
  name: string;
  branchId: Guid;
  createdAt: Iso8601;
  createdByName: string | null;
  expiresAt: Iso8601;
  lastUsedAt: Iso8601 | null;
  revokedAt: Iso8601 | null;
  isActive: boolean;
  lockedUntil: Iso8601 | null;
}

export interface CurrentDeviceDto {
  id: Guid;
  name: string;
  branchId: Guid;
  branchName: string;
  organizationName: string;
}

export interface DeviceStaffDto {
  id: Guid;
  fullName: string;
}
