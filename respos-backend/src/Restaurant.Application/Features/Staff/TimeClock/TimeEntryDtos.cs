using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Entities.Staff;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Staff.TimeClock;

/// <summary>Time entry; <c>workedMinutes</c> = (clock-out or now) − clock-in − break.</summary>
public sealed record TimeEntryDto(
    Guid Id,
    Guid UserId,
    string? UserName,
    Guid BranchId,
    DateTime ClockInAt,
    DateTime? ClockOutAt,
    int BreakMinutes,
    int WorkedMinutes,
    bool IsOpen,
    TimeEntrySource Source,
    string? Note,
    Guid? EditedBy,
    string? EditedByName,
    DateTime? EditedAt,
    string? EditReason);

/// <summary>The caller's clock state: the open entry (any branch of the org) and minutes worked today in this branch.</summary>
public sealed record MyTimeClockDto(TimeEntryDto? OpenEntry, int TodayWorkedMinutes);

/// <summary>Maps entries to DTOs with user / editor names (one query for all names).</summary>
[ScopedService]
public sealed class TimeEntryReader(IApplicationDbContext db, StaffDirectory directory)
{
    public async Task<IReadOnlyList<TimeEntryDto>> ToDtosAsync(IReadOnlyList<TimeEntry> entries, DateTime now, CancellationToken ct)
    {
        var ids = entries.Select(e => e.UserId).Concat(entries.Where(e => e.EditedBy != null).Select(e => e.EditedBy!.Value));
        var names = await directory.NamesAsync(ids, ct);
        return entries.Select(e => ToDto(e, names, now)).ToList();
    }

    public async Task<TimeEntryDto> ToDtoAsync(TimeEntry entry, DateTime now, CancellationToken ct) =>
        (await ToDtosAsync([entry], now, ct))[0];

    public Task<TimeEntry?> FindOpenAsync(Guid userId, CancellationToken ct) =>
        db.TimeEntries.FirstOrDefaultAsync(e => e.UserId == userId && e.ClockOutAt == null, ct);

    private static TimeEntryDto ToDto(TimeEntry e, IReadOnlyDictionary<Guid, string> names, DateTime now) => new(
        e.Id, e.UserId, names.GetValueOrDefault(e.UserId), e.BranchId, e.ClockInAt, e.ClockOutAt, e.BreakMinutes, e.WorkedMinutes(now),
        e.IsOpen, e.Source, e.Note, e.EditedBy, e.EditedBy is { } by ? names.GetValueOrDefault(by) : null, e.EditedAt, e.EditReason);
}
