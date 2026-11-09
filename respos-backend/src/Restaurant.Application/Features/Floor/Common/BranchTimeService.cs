using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Floor.Common;

/// <summary>Converts between UTC and the branch timezone (default Asia/Tashkent).</summary>
[ScopedService]
public sealed class BranchTimeService(IApplicationDbContext db, IClock clock)
{
    private readonly Dictionary<Guid, TimeZoneInfo> _cache = [];

    public async Task<TimeZoneInfo> TimeZoneAsync(Guid branchId, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(branchId, out var cached))
        {
            return cached;
        }

        var id = await db.Branches.AsNoTracking().Where(b => b.Id == branchId)
            .Select(b => b.Timezone).FirstOrDefaultAsync(cancellationToken);
        var zone = Resolve(id);
        _cache[branchId] = zone;
        return zone;
    }

    public async Task<DateTime> LocalNowAsync(Guid branchId, CancellationToken cancellationToken) =>
        TimeZoneInfo.ConvertTimeFromUtc(clock.UtcNow, await TimeZoneAsync(branchId, cancellationToken));

    /// <summary>UTC range [start, end) of a branch-local calendar date.</summary>
    public async Task<(DateTime Start, DateTime End)> DayRangeUtcAsync(Guid branchId, DateOnly date, CancellationToken cancellationToken)
    {
        var zone = await TimeZoneAsync(branchId, cancellationToken);
        var start = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);
        var end = TimeZoneInfo.ConvertTimeToUtc(date.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);
        return (start, end);
    }

    public static TimeZoneInfo Resolve(string? timezoneId) =>
        !string.IsNullOrWhiteSpace(timezoneId) && TimeZoneInfo.TryFindSystemTimeZoneById(timezoneId, out var zone)
            ? zone
            : TimeZoneInfo.TryFindSystemTimeZoneById(RestaurantBranch.DefaultTimezone, out var fallback) ? fallback : TimeZoneInfo.Utc;

    /// <summary>Normalizes client-supplied timestamps to UTC (unspecified kind is treated as UTC).</summary>
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
