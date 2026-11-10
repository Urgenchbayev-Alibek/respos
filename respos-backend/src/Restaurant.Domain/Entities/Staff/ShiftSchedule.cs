using Restaurant.Domain.Common;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Staff;

/// <summary>
/// Planned shift of an employee in a branch on a local date. <see cref="EndTime"/> ≤ <see cref="StartTime"/>
/// means the shift ends the next day (overnight).
/// </summary>
public class ShiftSchedule : AuditableEntity, IBranchScoped
{
    public const int MinutesPerDay = 24 * 60;

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }
    public Guid UserId { get; private set; }
    public DateOnly Date { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public string? RoleNote { get; private set; }
    public string? Note { get; private set; }

    public int PlannedMinutes => CalculateMinutes(StartTime, EndTime);

    public static ShiftSchedule Create(
        Guid branchId, Guid userId, DateOnly date, TimeOnly start, TimeOnly end, string? roleNote, string? note)
    {
        var shift = new ShiftSchedule { BranchId = branchId };
        shift.Update(userId, date, start, end, roleNote, note);
        return shift;
    }

    public void Update(Guid userId, DateOnly date, TimeOnly start, TimeOnly end, string? roleNote, string? note)
    {
        if (start == end)
        {
            throw new DomainException(ShiftScheduleErrors.InvalidTime);
        }

        UserId = userId;
        Date = date;
        StartTime = start;
        EndTime = end;
        RoleNote = roleNote;
        Note = note;
    }

    /// <summary>Planned length; end ≤ start = overnight (TimeOnly subtraction wraps around midnight).</summary>
    public static int CalculateMinutes(TimeOnly start, TimeOnly end) => (int)(end - start).TotalMinutes;

    /// <summary>Absolute minutes since day 0 of the calendar: <c>[start, end)</c>, used for overlap checks.</summary>
    public static (int Start, int End) AbsoluteRange(DateOnly date, TimeOnly start, TimeOnly end)
    {
        var from = date.DayNumber * MinutesPerDay + start.Hour * 60 + start.Minute;
        return (from, from + CalculateMinutes(start, end));
    }

    public static bool Overlaps((int Start, int End) a, (int Start, int End) b) => a.Start < b.End && b.Start < a.End;
}
