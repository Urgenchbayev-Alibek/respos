using System.Globalization;

namespace Restaurant.Application.Features.Reservations.Availability;

/// <summary>Config section <c>Reservations:Availability</c> (branch-local times; same for all branches until per-branch hours exist).</summary>
public sealed class ReservationAvailabilityOptions
{
    public const string SectionName = "Reservations:Availability";

    public string OpenTime { get; set; } = "10:00";
    /// <summary>Last slot START time (local).</summary>
    public string LastSlotTime { get; set; } = "22:00";
    public int SlotMinutes { get; set; } = 30;
    public int DurationMinutes { get; set; } = 120;
    /// <summary>Online bookings must start at least this long from now.</summary>
    public int MinLeadMinutes { get; set; } = 60;
    public int MaxDaysAhead { get; set; } = 60;
    public int MaxOnlineGuests { get; set; } = 20;

    public TimeOnly Open => ParseTime(OpenTime, new TimeOnly(10, 0));

    public TimeOnly LastSlot => ParseTime(LastSlotTime, new TimeOnly(22, 0));

    public static TimeOnly ParseTime(string? value, TimeOnly fallback) =>
        TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : fallback;
}

public sealed record AvailabilityTable(Guid Id, string Number, int Capacity, Guid AreaId, string? AreaName);

/// <summary>An active (pending / confirmed / seated) reservation occupying a table on [Start, End).</summary>
public sealed record BusyInterval(Guid TableId, DateTime Start, DateTime End);

public sealed record SlotAvailability(string Time, DateTime StartsAt, DateTime EndsAt, IReadOnlyList<AvailabilityTable> FreeTables);

/// <param name="Open">First slot start (local).</param>
/// <param name="LastSlot">Last slot start (local, inclusive).</param>
public sealed record SlotGrid(TimeOnly Open, TimeOnly LastSlot, int SlotMinutes, int DurationMinutes);

/// <summary>
/// Pure availability rules (BR-5.2 overlap on half-open intervals): a table is free for a slot when its capacity fits the
/// party and no active reservation of that table overlaps [start, start + duration). Slots before
/// <c>notBeforeUtc</c> have no free tables.
/// </summary>
public static class AvailabilityCalculator
{
    public static IReadOnlyList<SlotAvailability> Calculate(
        DateOnly date, TimeZoneInfo zone, SlotGrid grid, int guests,
        IReadOnlyCollection<AvailabilityTable> tables, IReadOnlyCollection<BusyInterval> busy, DateTime notBeforeUtc)
    {
        var fitting = tables.Where(t => t.Capacity >= guests)
            .OrderBy(t => t.Capacity).ThenBy(t => t.Number, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var byTable = busy.GroupBy(b => b.TableId).ToDictionary(g => g.Key, g => g.ToList());
        var slots = new List<SlotAvailability>();
        foreach (var local in SlotTimes(grid))
        {
            var start = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(local, DateTimeKind.Unspecified), zone);
            var end = start.AddMinutes(grid.DurationMinutes);
            IReadOnlyList<AvailabilityTable> free = start < notBeforeUtc
                ? []
                : fitting.Where(t => IsFree(byTable.GetValueOrDefault(t.Id), start, end)).ToList();
            slots.Add(new SlotAvailability(local.ToString("HH:mm", CultureInfo.InvariantCulture), start, end, free));
        }

        return slots;
    }

    public static IEnumerable<TimeOnly> SlotTimes(SlotGrid grid)
    {
        var step = Math.Clamp(grid.SlotMinutes, 5, 240);
        for (var minutes = grid.Open.Hour * 60 + grid.Open.Minute;
             minutes <= grid.LastSlot.Hour * 60 + grid.LastSlot.Minute;
             minutes += step)
        {
            yield return new TimeOnly(minutes / 60, minutes % 60);
        }
    }

    public static bool IsFree(IEnumerable<BusyInterval>? busy, DateTime start, DateTime end) =>
        busy is null || !busy.Any(b => b.Start < end && start < b.End);
}
