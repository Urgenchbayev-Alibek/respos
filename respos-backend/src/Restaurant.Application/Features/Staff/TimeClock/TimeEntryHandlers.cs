using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.TimeClock;

/// <summary><c>GET /staff/time-entries?userId&amp;from&amp;to&amp;openOnly&amp;page&amp;pageSize</c> (local branch dates; default last 7 days).</summary>
public sealed record ListTimeEntriesQuery : PageQuery
{
    public Guid? UserId { get; init; }
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
    public bool OpenOnly { get; init; }
}

public sealed class ListTimeEntriesValidator : AbstractValidator<ListTimeEntriesQuery>
{
    public ListTimeEntriesValidator() =>
        RuleFor(x => x.To).Must((q, to) => q.From is null || to is null || to >= q.From)
            .WithErrorCode("report.invalid_period").WithMessage("'to' must not be earlier than 'from'.");
}

/// <summary>Entries of the current branch overlapping the period (open entries always included), newest first.</summary>
public sealed class ListTimeEntriesHandler(IApplicationDbContext db, IClock clock, ReportScope scope, TimeEntryReader reader)
    : IHandler<ListTimeEntriesQuery, PagedResult<TimeEntryDto>>
{
    public async Task<Result<PagedResult<TimeEntryDto>>> HandleAsync(ListTimeEntriesQuery request, CancellationToken cancellationToken)
    {
        var period = await StaffPeriod.ResolveAsync(scope, request.From, request.To, defaultDays: 7, cancellationToken);
        var query = db.TimeEntries.AsNoTracking().Where(e => e.BranchId == period.BranchId);
        query = request.OpenOnly
            ? query.Where(e => e.ClockOutAt == null)
            : query.Where(e => e.ClockOutAt == null
                               || (e.ClockInAt < period.Utc.ToUtc && e.ClockOutAt > period.Utc.FromUtc));
        if (request.UserId is { } userId)
        {
            query = query.Where(e => e.UserId == userId);
        }

        var total = await query.CountAsync(cancellationToken);
        var entries = await query.OrderByDescending(e => e.ClockInAt)
            .Skip((request.SafePage - 1) * request.SafePageSize).Take(request.SafePageSize)
            .ToListAsync(cancellationToken);
        var items = await reader.ToDtosAsync(entries, clock.UtcNow, cancellationToken);
        return new PagedResult<TimeEntryDto>(items, request.SafePage, request.SafePageSize, total);
    }
}

public sealed record CreateTimeEntryCommand(Guid UserId, DateTime ClockInAt, DateTime? ClockOutAt, int BreakMinutes, string? Note, string Reason);

public sealed class CreateTimeEntryValidator : AbstractValidator<CreateTimeEntryCommand>
{
    public CreateTimeEntryValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.BreakMinutes).InclusiveBetween(0, TimeEntry.MaxBreakMinutes);
        RuleFor(x => x.Note).MaximumLength(500);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

/// <summary><c>POST /staff/time-entries</c> (<c>staff.manage</c>): manual entry for an employee of the branch (reason required, audited).</summary>
public sealed class CreateTimeEntryHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, StaffDirectory directory, TimeEntryReader reader, IAuditLogger audit)
    : IHandler<CreateTimeEntryCommand, TimeEntryDto>
{
    public async Task<Result<TimeEntryDto>> HandleAsync(CreateTimeEntryCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        if (!await directory.IsBranchMemberAsync(request.UserId, tenant.RequireOrganizationId(), branchId, cancellationToken))
        {
            return StaffErrors.MemberNotFound;
        }

        if (request.ClockOutAt is null && await reader.FindOpenAsync(request.UserId, cancellationToken) is not null)
        {
            return TimeEntryErrors.AlreadyOpen;
        }

        var now = clock.UtcNow;
        var entry = TimeEntry.CreateManual(
            branchId, request.UserId, ToUtc(request.ClockInAt), request.ClockOutAt is { } outAt ? ToUtc(outAt) : null,
            request.BreakMinutes, ClockInHandler.Normalize(request.Note), tenant.RequireUserId(), request.Reason.Trim(), now);
        db.TimeEntries.Add(entry);
        audit.Log("staff.time_entry_created", nameof(TimeEntry), entry.Id, new
        {
            entry.UserId, entry.ClockInAt, entry.ClockOutAt, entry.BreakMinutes, reason = entry.EditReason,
        });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.ToDtoAsync(entry, now, cancellationToken);
    }

    internal static DateTime ToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

public sealed record UpdateTimeEntryCommand(DateTime ClockInAt, DateTime? ClockOutAt, int BreakMinutes, string? Note, string Reason)
{
    [JsonIgnore]
    public Guid EntryId { get; init; }
}

public sealed class UpdateTimeEntryValidator : AbstractValidator<UpdateTimeEntryCommand>
{
    public UpdateTimeEntryValidator()
    {
        RuleFor(x => x.BreakMinutes).InclusiveBetween(0, TimeEntry.MaxBreakMinutes);
        RuleFor(x => x.Note).MaximumLength(500);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

/// <summary>
/// <c>PUT /staff/time-entries/{id}</c> (<c>staff.manage</c>): correction of an entry of the current branch (e.g. forgotten clock-out).
/// Reason required; the audit row keeps before/after values.
/// </summary>
public sealed class UpdateTimeEntryHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, TimeEntryReader reader, IAuditLogger audit)
    : IHandler<UpdateTimeEntryCommand, TimeEntryDto>
{
    public async Task<Result<TimeEntryDto>> HandleAsync(UpdateTimeEntryCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var entry = await db.TimeEntries.FirstOrDefaultAsync(e => e.Id == request.EntryId && e.BranchId == branchId, cancellationToken);
        if (entry is null)
        {
            return TimeEntryErrors.NotFound;
        }

        if (!entry.IsOpen && request.ClockOutAt is null && await reader.FindOpenAsync(entry.UserId, cancellationToken) is not null)
        {
            return TimeEntryErrors.AlreadyOpen;
        }

        var before = new { entry.ClockInAt, entry.ClockOutAt, entry.BreakMinutes, entry.Note };
        var now = clock.UtcNow;
        entry.Correct(
            CreateTimeEntryHandler.ToUtc(request.ClockInAt),
            request.ClockOutAt is { } outAt ? CreateTimeEntryHandler.ToUtc(outAt) : null,
            request.BreakMinutes, ClockInHandler.Normalize(request.Note), tenant.RequireUserId(), request.Reason.Trim(), now);
        audit.Log("staff.time_entry_corrected", nameof(TimeEntry), entry.Id, new
        {
            before,
            after = new { entry.ClockInAt, entry.ClockOutAt, entry.BreakMinutes, entry.Note },
            reason = entry.EditReason,
        });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.ToDtoAsync(entry, now, cancellationToken);
    }
}

internal static class StaffPeriod
{
    /// <summary>Explicit local dates, or the last <paramref name="defaultDays"/> local days of the branch when none given.</summary>
    public static async Task<ReportContext> ResolveAsync(
        ReportScope scope, DateOnly? from, DateOnly? to, int defaultDays, CancellationToken ct)
    {
        if (from is not null || to is not null)
        {
            return await scope.ResolveAsync(new ReportPeriodQuery { From = from, To = to }, ct);
        }

        var today = (await scope.ResolveAsync(null, ct)).Today;
        return await scope.ResolveAsync(new ReportPeriodQuery { From = today.AddDays(1 - defaultDays), To = today }, ct);
    }
}
