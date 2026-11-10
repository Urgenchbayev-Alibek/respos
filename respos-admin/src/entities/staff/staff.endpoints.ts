/** F6 REST paths (respos-contracts/v2/F6-staff.md), relative to VITE_API_BASE_URL. */
const id = (value: string) => encodeURIComponent(value);

export const STAFF_ENDPOINTS = {
  timeClock: {
    me: '/staff/time-clock/me',
    clockIn: '/staff/time-clock/clock-in',
    clockOut: '/staff/time-clock/clock-out',
  },
  timeEntries: { list: '/staff/time-entries', one: (entryId: string) => `/staff/time-entries/${id(entryId)}` },
  timesheet: { report: '/staff/timesheet', export: '/staff/timesheet/export' },
  schedule: { list: '/staff/schedule', my: '/staff/schedule/my', one: (shiftId: string) => `/staff/schedule/${id(shiftId)}` },
  members: { list: '/staff/members', pin: (userId: string) => `/staff/members/${id(userId)}/pin` },
  devices: { list: '/staff/devices', revoke: (deviceId: string) => `/staff/devices/${id(deviceId)}/revoke` },
  auth: {
    device: '/auth/device',
    deviceStaff: '/auth/device/staff',
    deviceRegister: '/auth/device/register',
    deviceForget: '/auth/device/forget',
    pinLogin: '/auth/pin-login',
    pin: '/auth/pin',
  },
} as const;
