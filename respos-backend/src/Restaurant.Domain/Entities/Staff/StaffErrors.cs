using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Staff;

public static class TimeEntryErrors
{
    public static readonly Error NotFound = Error.NotFound("time_entry.not_found", "Time entry not found.");
    public static readonly Error AlreadyOpen = Error.Conflict("time_entry.already_open", "The employee is already clocked in.");
    public static readonly Error NotOpen = Error.Conflict("time_entry.not_open", "The employee is not clocked in.");
    public static readonly Error InvalidPeriod =
        Error.Validation("time_entry.invalid_period", "Clock-out must be later than clock-in and not in the future.");
    public static readonly Error InvalidBreak =
        Error.Validation("time_entry.invalid_break", "Break must not be negative or longer than the worked time.");
}

public static class ShiftScheduleErrors
{
    public static readonly Error NotFound = Error.NotFound("shift.not_found", "Scheduled shift not found.");
    public static readonly Error Overlap = Error.Conflict("shift.overlap", "The employee already has a shift at this time.");
    public static readonly Error InvalidTime = Error.Validation("shift.invalid_time", "Shift start and end must differ.");
}

public static class StaffErrors
{
    public static readonly Error MemberNotFound = Error.NotFound("staff.member_not_found", "Employee not found in this branch.");
    public static readonly Error DeviceNotFound = Error.NotFound("device.not_found", "Device not found.");
    public static readonly Error DeviceInvalid =
        Error.Unauthorized("device.invalid", "This device is not registered for shared mode or was revoked.");
    public static readonly Error DeviceLocked =
        Error.Unauthorized("device.locked", "Too many wrong PINs on this device. Try again later.");
    public static readonly Error PinInvalid = Error.Unauthorized("pin.invalid", "Wrong PIN.");
    public static readonly Error PinLocked = Error.Unauthorized("pin.locked", "Too many wrong PINs. PIN login is temporarily locked.");
    public static readonly Error PinNotAllowed =
        Error.Forbidden("pin.not_allowed", "PIN login is not allowed for owners, administrators and platform admins.");
    public static readonly Error PinWeak = Error.Validation("pin.weak", "PIN must be 4-6 digits and not trivial (e.g. 1111, 1234).");
}
