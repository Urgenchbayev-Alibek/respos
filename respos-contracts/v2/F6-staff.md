# F6 — Staff: time clock, schedule, PIN quick login

Implements FEATURES_V2 §F6. Security design: `docs/architecture/ADR/0014-pin-quick-login-shared-devices.md`.
All v1 conventions apply (RFC 7807 errors with `code`, camelCase JSON, enums as snake_case strings, UTC ISO-8601 instants).
Branch-scoped endpoints require `X-Branch-Id` (`[RequireBranch]`); local dates/times are in the **branch timezone**.

## Permissions

| Permission | Grants |
|---|---|
| `staff.timeclock` | own clock in / out / status (all operational system roles have it) |
| `staff.manage` | time entries of the branch (list, manual entry, correction), timesheet + CSV, schedule CRUD, members' PIN set/reset, shared devices (register, list, revoke, forget) |
| any signed-in user | own PIN (`/auth/pin`), own schedule (`/staff/schedule/my`) |

## Entities / tables (new, no changes to v1 tables)

| Table | Entity | Notes |
|---|---|---|
| `time_entries` | `TimeEntry` (branch-scoped) | `user_id, clock_in_at, clock_out_at?, break_minutes, source (self\|manager), note, edited_by?, edited_at?, edit_reason?` + audit stamps. Filtered unique index `(organization_id, user_id) WHERE clock_out_at IS NULL` → one open entry per user per org |
| `shift_schedules` | `ShiftSchedule` (branch-scoped) | `user_id, date (date), start_time, end_time (time), role_note, note`; end ≤ start = overnight |
| `staff_devices` | `StaffDevice` (branch-scoped) | `name, token_hash (SHA-256, unique), expires_at, last_used_at, revoked_at, revoked_by, failed_pin_count, lockout_until` |
| `staff_pins` | `StaffPin` (global, per user) | `user_id (unique), pin_hash (PBKDF2 PasswordHasher), updated_at, updated_by, failed_count, lockout_until` |
| `pin_sessions` | `PinSession` | `family_id (unique, = refresh-token family), device_id, organization_id, branch_id, user_id, created_at` |

Migration: one migration `Staff_F6` (orchestrator generates it on merge; the branch ships no migration).

## Time clock

| Method | Path | Perm | Body → Response |
|---|---|---|---|
| GET | `/staff/time-clock/me` | timeclock | → `MyTimeClockDto { openEntry: TimeEntryDto \| null, todayWorkedMinutes }` (open entry may be in another branch of the org) |
| POST | `/staff/time-clock/clock-in` | timeclock | `{ note? }` → 201 `TimeEntryDto`; 409 `time_entry.already_open` |
| POST | `/staff/time-clock/clock-out` | timeclock | `{ breakMinutes?, note? }` → 200 `TimeEntryDto`; 409 `time_entry.not_open` (none open in **this** branch) |
| GET | `/staff/time-entries?userId&from&to&openOnly&page&pageSize` | manage | → `PagedResult<TimeEntryDto>`; `from/to` = local dates (default last 7 days); entries overlapping the period + all open ones; newest first |
| POST | `/staff/time-entries` | manage | `{ userId, clockInAt, clockOutAt?, breakMinutes, note?, reason }` → 201 (source `manager`) |
| PUT | `/staff/time-entries/{id}` | manage | `{ clockInAt, clockOutAt?, breakMinutes, note?, reason }` → 200; audit `staff.time_entry_corrected` with `before`/`after`/`reason` |

`TimeEntryDto { id, userId, userName, branchId, clockInAt, clockOutAt, breakMinutes, workedMinutes, isOpen, source, note, editedBy, editedByName, editedAt, editReason }`.
`workedMinutes = floor((clockOut ?? now) − clockIn) − break`, never negative. Rules: clock-in ≤ now, clock-out > clock-in and ≤ now
(`time_entry.invalid_period`), 0 ≤ break ≤ duration (`time_entry.invalid_break`), `reason` required for manager writes (400).

## Timesheet

| GET | `/staff/timesheet?from&to&userId` | manage | → `TimesheetDto { from, to, rows[], totalWorkedMinutes, totalPlannedMinutes }` |
|---|---|---|---|
| GET | `/staff/timesheet/export?from&to&userId` | manage | `text/csv` UTF-8 BOM: `employee,date,planned_hours,worked_hours,difference_hours` + a `total` row per employee |

`TimesheetRowDto { userId, fullName, workedMinutes, plannedMinutes, entries, hasOpenEntry, days: [{ date, workedMinutes, plannedMinutes }] }`.
Worked time is attributed to the **local date of clock-in** (overnight shifts count to their start day); planned = Σ shifts by date.
Period: local dates inclusive, ≤ 366 days (`report.invalid_period`), default today.

## Schedule

| Method | Path | Perm | Body → Response |
|---|---|---|---|
| GET | `/staff/schedule?from&to&userId` | manage | → `ShiftDto[]` (≤ 62 days, `shift.invalid_period`) |
| GET | `/staff/schedule/my?from&to` | signed in | own shifts in the current branch |
| POST | `/staff/schedule` | manage | `{ userId, date, startTime "HH:mm", endTime "HH:mm", roleNote?, note? }` → 201 |
| PUT | `/staff/schedule/{id}` | manage | same body → 200 |
| DELETE | `/staff/schedule/{id}` | manage | → 204 |

`ShiftDto { id, userId, userName, branchId, date, startTime, endTime, plannedMinutes, roleNote, note }`. The employee must be an
active member with access to the branch (`staff.member_not_found` 404). Overlap with another shift of the same employee in any
branch of the org (overnight-aware) → 409 `shift.overlap`. `start == end` → `shift.invalid_time`. Audited `staff.shift_*`.

## Members & PIN management

| Method | Path | Perm | Body → Response |
|---|---|---|---|
| GET | `/staff/members` | manage | → `StaffMemberDto[] { userId, fullName, email, roles[], hasPin, pinAllowed, pinLockedUntil }` |
| PUT | `/staff/members/{userId}/pin` | manage | `{ pin }` → `PinStatusDto`; audit `staff.pin_set` (`by: manager`) |
| DELETE | `/staff/members/{userId}/pin` | manage | → 204 (removes PIN, clears lockout); audit `staff.pin_reset` |
| GET | `/auth/pin` | signed in | → `PinStatusDto { hasPin, allowed, updatedAt, lockedUntil }` (no branch header) |
| PUT | `/auth/pin` | signed in | `{ currentPassword, pin }` → `PinStatusDto`; wrong password → 400 `auth.invalid_current_password` |
| DELETE | `/auth/pin` | signed in | → 204 |

PIN policy: 4–6 ASCII digits, not all equal, not an ascending/descending run (`pin.weak` as validation error code).
Owner/admin role (in any org) or platform admin → 403 `pin.not_allowed`.

## Shared devices + PIN login (ADR-0014)

The device credential is **only** the httpOnly cookie `device_token` (Path `/api/v1/auth`, SameSite/Secure as the refresh cookie,
lifetime `Auth:DeviceTokenDays` = 180). It is never in a body, header or JS-readable storage.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/device/register` | `staff.manage` + `X-Branch-Id` | `{ name }` → 201 `DeviceDto` + `Set-Cookie: device_token`; audit `staff.device_registered` |
| GET | `/auth/device` | anonymous (cookie) | → `CurrentDeviceDto { id, name, branchId, branchName, organizationName }`; 401 `device.invalid` |
| GET | `/auth/device/staff` | anonymous (cookie) | → `[{ id, fullName }]` — PIN-enabled, PIN-eligible members of the device branch only |
| POST | `/auth/pin-login` | anonymous (cookie) | `{ userId, pin }` → 200 `AuthResponse` + `Set-Cookie: refresh_token` (same shape as `/auth/login`) |
| POST | `/auth/device/forget` | `staff.manage` | → 204; revokes the cookie's device (own org only) + its PIN sessions, deletes the cookie |
| GET | `/staff/devices?includeRevoked` | `staff.manage` + branch | → `DeviceDto[] { id, name, branchId, createdAt, createdByName, expiresAt, lastUsedAt, revokedAt, isActive, lockedUntil }` |
| POST | `/staff/devices/{id}/revoke` | `staff.manage` + branch | → `DeviceDto`; ends all PIN sessions of the device; audit `staff.device_revoked` |

`userId` is required in `pin-login` (the lock screen picks the employee; PIN collisions are allowed and never searched).
PIN login errors (all 401): `device.invalid` (no/unknown/revoked/expired cookie, branch or org inactive), `device.locked`
(10 wrong PINs on the device → 15 min), `pin.invalid` (wrong PIN **or** user not eligible — no enumeration), `pin.locked`
(5 wrong PINs for the user → 15 min). Rate limit: `auth` policy (20/min/IP) → 429 `rate_limit.exceeded`.
Audit: `auth.pin_login_succeeded`, `auth.pin_locked`, `staff.device_locked`.

**PIN session**: access token as usual (15 min) + claim `branch_scope=<device branch>`; `MeDto.branches` contains only that branch;
`X-Branch-Id` of any other branch → 403 `tenant.branch_forbidden` (also SignalR `JoinBranch`). Refresh token lifetime
`Auth:PinSessionHours` = 12 (absolute from the PIN login). `/auth/refresh` of a PIN session requires the same active
`device_token` cookie and a still-eligible user, else 401 `auth.invalid_refresh_token` (token revoked). A successful
pin-login revokes the refresh token previously held by the browser (user switch).

Config (`Auth` section): `PinMaxFailedAttempts` 5, `PinLockoutMinutes` 15, `DeviceMaxFailedPinAttempts` 10, `DeviceTokenDays` 180, `PinSessionHours` 12.

## Error codes (new)

`time_entry.not_found` 404, `time_entry.already_open` 409, `time_entry.not_open` 409, `time_entry.invalid_period` 400,
`time_entry.invalid_break` 400, `shift.not_found` 404, `shift.overlap` 409, `shift.invalid_time` 400, `shift.invalid_period` 400,
`staff.member_not_found` 404, `device.not_found` 404, `device.invalid` 401, `device.locked` 401, `pin.invalid` 401,
`pin.locked` 401, `pin.not_allowed` 403, `pin.weak` (validation field code).

## Frontend (respos-admin)

- Admin → **Персонал / Staff** (`/admin/staff`, `staff.manage`): tabs time entries, timesheet (CSV), weekly schedule grid, members (PIN), shared devices.
- Topbar «Начать/Закончить смену» (`staff.timeclock`) in admin, waiter, cashier, stock and kitchen layouts.
- `/device` — lock screen (avatar grid + large keypad); `/login` redirects there on shared devices (`?password=1` forces the password form).
- «Сменить пользователя» in workspace + kitchen topbars on shared devices (logout → lock screen).
- Profile: own PIN (password-confirmed), own schedule for 14 days.
