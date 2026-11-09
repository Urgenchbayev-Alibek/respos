using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Reports.Common;

/// <summary>A half-open UTC interval <c>[FromUtc, ToUtc)</c>.</summary>
public readonly record struct UtcRange(DateTime FromUtc, DateTime ToUtc);

/// <summary>
/// Branch-timezone helpers (IANA ids, e.g. <c>Asia/Tashkent</c>; .NET 8 resolves them on Windows and Linux).
/// Day boundaries are local midnights: 2026-11-09T19:00Z is 2026-11-10 00:00 in Tashkent (UTC+5).
/// </summary>
public static class BranchTime
{
    public static TimeZoneInfo Resolve(string? timezoneId)
    {
        if (!string.IsNullOrWhiteSpace(timezoneId) && TimeZoneInfo.TryFindSystemTimeZoneById(timezoneId, out var zone))
        {
            return zone;
        }

        return TimeZoneInfo.TryFindSystemTimeZoneById(RestaurantBranch.DefaultTimezone, out var fallback)
            ? fallback
            : TimeZoneInfo.Utc;
    }

    public static DateOnly LocalDate(DateTime utc, TimeZoneInfo zone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone));

    /// <summary>UTC interval covering the local days <paramref name="from"/>..<paramref name="to"/> (inclusive).</summary>
    public static UtcRange ToUtcRange(DateOnly from, DateOnly to, TimeZoneInfo zone) =>
        new(LocalMidnightToUtc(from, zone), LocalMidnightToUtc(to.AddDays(1), zone));

    private static DateTime LocalMidnightToUtc(DateOnly date, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        while (zone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }

        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }
}
