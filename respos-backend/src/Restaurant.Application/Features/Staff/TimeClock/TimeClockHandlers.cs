using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.TimeClock;

public sealed record GetMyTimeClockQuery;

/// <summary><c>GET /staff/time-clock/me</c> (<c>staff.timeclock</c>).</summary>
public sealed class GetMyTimeClockHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, TimeEntryReader reader, ReportScope scope)
    : IHandler<GetMyTimeClockQuery, MyTimeClockDto>
{
    public async Task<Result<MyTimeClockDto>> HandleAsync(GetMyTimeClockQuery request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var now = clock.UtcNow;
        var period = await scope.ResolveAsync(null, cancellationToken);
        var today = await db.TimeEntries.AsNoTracking()
            .Where(e => e.BranchId == period.BranchId && e.UserId == userId
                        && e.ClockInAt < period.Utc.ToUtc && (e.ClockOutAt == null || e.ClockOutAt > period.Utc.FromUtc))
            .ToListAsync(cancellationToken);
        var open = await reader.FindOpenAsync(userId, cancellationToken);
        var worked = today.Sum(e => e.WorkedMinutes(now));
        return new MyTimeClockDto(open is null ? null : await reader.ToDtoAsync(open, now, cancellationToken), worked);
    }
}

public sealed record ClockInCommand(string? Note);

public sealed class ClockInValidator : AbstractValidator<ClockInCommand>
{
    public ClockInValidator() => RuleFor(x => x.Note).MaximumLength(500);
}

/// <summary>
/// <c>POST /staff/time-clock/clock-in</c> (<c>staff.timeclock</c>): opens an entry for the caller in the current branch.
/// One open entry per user in the organization → 409 <c>time_entry.already_open</c> (DB filtered unique index as safety net).
/// </summary>
public sealed class ClockInHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, TimeEntryReader reader, IAuditLogger audit)
    : IHandler<ClockInCommand, TimeEntryDto>
{
    public async Task<Result<TimeEntryDto>> HandleAsync(ClockInCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var branchId = tenant.RequireBranchId();
        if (await reader.FindOpenAsync(userId, cancellationToken) is not null)
        {
            return TimeEntryErrors.AlreadyOpen;
        }

        var now = clock.UtcNow;
        var entry = TimeEntry.ClockIn(branchId, userId, now, Normalize(request.Note));
        db.TimeEntries.Add(entry);
        audit.Log("staff.clocked_in", nameof(TimeEntry), entry.Id, new { entry.ClockInAt });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.ToDtoAsync(entry, now, cancellationToken);
    }

    internal static string? Normalize(string? note) => string.IsNullOrWhiteSpace(note) ? null : note.Trim();
}

public sealed record ClockOutCommand(int? BreakMinutes, string? Note);

public sealed class ClockOutValidator : AbstractValidator<ClockOutCommand>
{
    public ClockOutValidator()
    {
        RuleFor(x => x.BreakMinutes).InclusiveBetween(0, TimeEntry.MaxBreakMinutes);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

/// <summary>
/// <c>POST /staff/time-clock/clock-out</c> (<c>staff.timeclock</c>): closes the caller's open entry of the current branch
/// (409 <c>time_entry.not_open</c> when none); duration = now − clock-in − break.
/// </summary>
public sealed class ClockOutHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, TimeEntryReader reader, IAuditLogger audit)
    : IHandler<ClockOutCommand, TimeEntryDto>
{
    public async Task<Result<TimeEntryDto>> HandleAsync(ClockOutCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var entry = await reader.FindOpenAsync(tenant.RequireUserId(), cancellationToken);
        if (entry is null || entry.BranchId != branchId)
        {
            return TimeEntryErrors.NotOpen;
        }

        var now = clock.UtcNow;
        entry.ClockOut(now, request.BreakMinutes, ClockInHandler.Normalize(request.Note));
        audit.Log("staff.clocked_out", nameof(TimeEntry), entry.Id, new { entry.ClockOutAt, entry.BreakMinutes });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.ToDtoAsync(entry, now, cancellationToken);
    }
}
