using System.Globalization;
using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.Schedule;

/// <summary>Planned shift; times are local branch time <c>HH:mm</c>; <c>endTime ≤ startTime</c> = ends next day.</summary>
public sealed record ShiftDto(
    Guid Id, Guid UserId, string? UserName, Guid BranchId, DateOnly Date, string StartTime, string EndTime, int PlannedMinutes,
    string? RoleNote, string? Note);

/// <summary><c>?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</c> (inclusive, ≤ 62 days) and optional <c>userId</c>.</summary>
public sealed record ListShiftsQuery(DateOnly From, DateOnly To, Guid? UserId = null);

public sealed class ListShiftsValidator : AbstractValidator<ListShiftsQuery>
{
    public const int MaxDays = 62;

    public ListShiftsValidator()
    {
        RuleFor(x => x.From).NotEmpty();
        RuleFor(x => x.To).NotEmpty()
            .Must((q, to) => to >= q.From && to.DayNumber - q.From.DayNumber < MaxDays)
            .WithErrorCode("shift.invalid_period").WithMessage($"'to' must be within {MaxDays} days after 'from'.");
    }
}

/// <summary><c>GET /staff/schedule</c> (<c>staff.manage</c>): shifts of the current branch (weekly grid).</summary>
public sealed class ListShiftsHandler(IApplicationDbContext db, ITenantContext tenant, ShiftReader reader)
    : IHandler<ListShiftsQuery, IReadOnlyList<ShiftDto>>
{
    public async Task<Result<IReadOnlyList<ShiftDto>>> HandleAsync(ListShiftsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.ShiftSchedules.AsNoTracking()
            .Where(s => s.BranchId == branchId && s.Date >= request.From && s.Date <= request.To);
        if (request.UserId is { } userId)
        {
            query = query.Where(s => s.UserId == userId);
        }

        return Result.Success(await reader.ToDtosAsync(await query.OrderBy(s => s.Date).ThenBy(s => s.StartTime).ToListAsync(cancellationToken), cancellationToken));
    }
}

public sealed record ListMyShiftsQuery(DateOnly From, DateOnly To);

public sealed class ListMyShiftsValidator : AbstractValidator<ListMyShiftsQuery>
{
    public ListMyShiftsValidator() =>
        RuleFor(x => x.To).Must((q, to) => to >= q.From && to.DayNumber - q.From.DayNumber < ListShiftsValidator.MaxDays)
            .WithErrorCode("shift.invalid_period").WithMessage("Invalid period.");
}

/// <summary><c>GET /staff/schedule/my</c> (any signed-in user): the caller's own shifts in the current branch.</summary>
public sealed class ListMyShiftsHandler(ListShiftsHandler inner, ITenantContext tenant) : IHandler<ListMyShiftsQuery, IReadOnlyList<ShiftDto>>
{
    public Task<Result<IReadOnlyList<ShiftDto>>> HandleAsync(ListMyShiftsQuery request, CancellationToken cancellationToken) =>
        inner.HandleAsync(new ListShiftsQuery(request.From, request.To, tenant.RequireUserId()), cancellationToken);
}

public sealed record SaveShiftCommand(Guid UserId, DateOnly Date, string StartTime, string EndTime, string? RoleNote, string? Note)
{
    /// <summary>Set by the controller for updates.</summary>
    [JsonIgnore]
    public Guid? ShiftId { get; init; }
}

public sealed class SaveShiftValidator : AbstractValidator<SaveShiftCommand>
{
    public SaveShiftValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.StartTime).Must(ShiftTime.IsValid).WithMessage("Use HH:mm.");
        RuleFor(x => x.EndTime).Must(ShiftTime.IsValid).WithMessage("Use HH:mm.");
        RuleFor(x => x.RoleNote).MaximumLength(64);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

/// <summary>
/// <c>POST /staff/schedule</c> and <c>PUT /staff/schedule/{id}</c> (<c>staff.manage</c>): employee must belong to the branch;
/// overlapping shifts of the same employee (any branch of the org, overnight-aware) → 409 <c>shift.overlap</c>. Audited.
/// </summary>
public sealed class SaveShiftHandler(
    IApplicationDbContext db, ITenantContext tenant, StaffDirectory directory, ShiftReader reader, IAuditLogger audit)
    : IHandler<SaveShiftCommand, ShiftDto>
{
    public async Task<Result<ShiftDto>> HandleAsync(SaveShiftCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        if (!await directory.IsBranchMemberAsync(request.UserId, tenant.RequireOrganizationId(), branchId, cancellationToken))
        {
            return StaffErrors.MemberNotFound;
        }

        ShiftSchedule? shift = null;
        if (request.ShiftId is { } id)
        {
            shift = await db.ShiftSchedules.FirstOrDefaultAsync(s => s.Id == id && s.BranchId == branchId, cancellationToken);
            if (shift is null)
            {
                return ShiftScheduleErrors.NotFound;
            }
        }

        var start = ShiftTime.Parse(request.StartTime);
        var end = ShiftTime.Parse(request.EndTime);
        if (await OverlapsAsync(request, start, end, cancellationToken))
        {
            return ShiftScheduleErrors.Overlap;
        }

        var roleNote = Trim(request.RoleNote);
        var note = Trim(request.Note);
        if (shift is null)
        {
            shift = ShiftSchedule.Create(branchId, request.UserId, request.Date, start, end, roleNote, note);
            db.ShiftSchedules.Add(shift);
        }
        else
        {
            shift.Update(request.UserId, request.Date, start, end, roleNote, note);
        }

        audit.Log(request.ShiftId is null ? "staff.shift_created" : "staff.shift_updated", nameof(ShiftSchedule), shift.Id, new
        {
            shift.UserId, shift.Date, request.StartTime, request.EndTime,
        });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.ToDtosAsync([shift], cancellationToken))[0];
    }

    private async Task<bool> OverlapsAsync(SaveShiftCommand request, TimeOnly start, TimeOnly end, CancellationToken ct)
    {
        var range = ShiftSchedule.AbsoluteRange(request.Date, start, end);
        var candidates = await db.ShiftSchedules.AsNoTracking()
            .Where(s => s.UserId == request.UserId && s.Id != request.ShiftId
                        && s.Date >= request.Date.AddDays(-1) && s.Date <= request.Date.AddDays(1))
            .ToListAsync(ct);
        return candidates.Any(s => ShiftSchedule.Overlaps(range, ShiftSchedule.AbsoluteRange(s.Date, s.StartTime, s.EndTime)));
    }

    private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record DeleteShiftCommand(Guid ShiftId);

/// <summary><c>DELETE /staff/schedule/{id}</c> (<c>staff.manage</c>). Audited.</summary>
public sealed class DeleteShiftHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit) : IHandler<DeleteShiftCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(DeleteShiftCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var shift = await db.ShiftSchedules.FirstOrDefaultAsync(s => s.Id == request.ShiftId && s.BranchId == branchId, cancellationToken);
        if (shift is null)
        {
            return ShiftScheduleErrors.NotFound;
        }

        db.ShiftSchedules.Remove(shift);
        audit.Log("staff.shift_deleted", nameof(ShiftSchedule), shift.Id, new { shift.UserId, shift.Date });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

[ScopedService]
public sealed class ShiftReader(StaffDirectory directory)
{
    public async Task<IReadOnlyList<ShiftDto>> ToDtosAsync(IReadOnlyList<ShiftSchedule> shifts, CancellationToken ct)
    {
        var names = await directory.NamesAsync(shifts.Select(s => s.UserId), ct);
        return shifts.Select(s => new ShiftDto(
            s.Id, s.UserId, names.GetValueOrDefault(s.UserId), s.BranchId, s.Date, ShiftTime.Format(s.StartTime),
            ShiftTime.Format(s.EndTime), s.PlannedMinutes, s.RoleNote, s.Note)).ToList();
    }
}

public static class ShiftTime
{
    private const string Pattern = "HH:mm";

    public static bool IsValid(string? value) =>
        TimeOnly.TryParseExact(value, Pattern, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    public static TimeOnly Parse(string value) => TimeOnly.ParseExact(value, Pattern, CultureInfo.InvariantCulture);

    public static string Format(TimeOnly value) => value.ToString(Pattern, CultureInfo.InvariantCulture);
}
