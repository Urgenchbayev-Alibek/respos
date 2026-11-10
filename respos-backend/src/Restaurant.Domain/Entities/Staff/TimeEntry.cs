using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Staff;

/// <summary>
/// One worked interval of an employee in a branch (clock in → clock out). At most one open entry per user
/// in an organization (filtered unique index). Manager corrections keep the editor, time and reason.
/// </summary>
public class TimeEntry : AuditableEntity, IBranchScoped
{
    public const int MaxBreakMinutes = 24 * 60;

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime ClockInAt { get; private set; }
    public DateTime? ClockOutAt { get; private set; }
    public int BreakMinutes { get; private set; }
    public TimeEntrySource Source { get; private set; }
    public string? Note { get; private set; }
    public Guid? EditedBy { get; private set; }
    public DateTime? EditedAt { get; private set; }
    public string? EditReason { get; private set; }

    public bool IsOpen => ClockOutAt is null;

    public static TimeEntry ClockIn(Guid branchId, Guid userId, DateTime utcNow, string? note) => new()
    {
        BranchId = branchId,
        UserId = userId,
        ClockInAt = utcNow,
        Source = TimeEntrySource.Self,
        Note = note,
    };

    /// <summary>Manual entry by a manager (forgotten clock-in); audited by the caller.</summary>
    public static TimeEntry CreateManual(
        Guid branchId, Guid userId, DateTime clockInAt, DateTime? clockOutAt, int breakMinutes, string? note,
        Guid editor, string reason, DateTime utcNow)
    {
        var entry = new TimeEntry { BranchId = branchId, UserId = userId, Source = TimeEntrySource.Manager };
        entry.Apply(clockInAt, clockOutAt, breakMinutes, note, utcNow);
        entry.MarkEdited(editor, reason, utcNow);
        return entry;
    }

    public void ClockOut(DateTime utcNow, int? breakMinutes, string? note)
    {
        if (!IsOpen)
        {
            throw new DomainException(TimeEntryErrors.NotOpen);
        }

        Apply(ClockInAt, utcNow, breakMinutes ?? BreakMinutes, note ?? Note, utcNow);
    }

    public void Correct(
        DateTime clockInAt, DateTime? clockOutAt, int breakMinutes, string? note, Guid editor, string reason, DateTime utcNow)
    {
        Apply(clockInAt, clockOutAt, breakMinutes, note, utcNow);
        MarkEdited(editor, reason, utcNow);
    }

    /// <summary>Worked minutes = (clock-out or now) − clock-in − break, never negative.</summary>
    public int WorkedMinutes(DateTime utcNow) => CalculateWorkedMinutes(ClockInAt, ClockOutAt ?? utcNow, BreakMinutes);

    public static int CalculateWorkedMinutes(DateTime clockInAt, DateTime clockOutAt, int breakMinutes) =>
        Math.Max(0, (int)Math.Floor((clockOutAt - clockInAt).TotalMinutes) - breakMinutes);

    private void Apply(DateTime clockInAt, DateTime? clockOutAt, int breakMinutes, string? note, DateTime utcNow)
    {
        if (clockInAt > utcNow || (clockOutAt is { } outAt && (outAt <= clockInAt || outAt > utcNow)))
        {
            throw new DomainException(TimeEntryErrors.InvalidPeriod);
        }

        var duration = (int)Math.Floor(((clockOutAt ?? utcNow) - clockInAt).TotalMinutes);
        if (breakMinutes < 0 || breakMinutes > MaxBreakMinutes || (clockOutAt is not null && breakMinutes > duration))
        {
            throw new DomainException(TimeEntryErrors.InvalidBreak);
        }

        ClockInAt = clockInAt;
        ClockOutAt = clockOutAt;
        BreakMinutes = breakMinutes;
        Note = note;
    }

    private void MarkEdited(Guid editor, string reason, DateTime utcNow)
    {
        EditedBy = editor;
        EditedAt = utcNow;
        EditReason = reason;
    }
}
