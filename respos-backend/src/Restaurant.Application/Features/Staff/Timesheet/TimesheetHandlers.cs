using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Export;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Staff.Timesheet;

public sealed record TimesheetDayDto(DateOnly Date, int WorkedMinutes, int PlannedMinutes);

public sealed record TimesheetRowDto(
    Guid UserId, string? FullName, int WorkedMinutes, int PlannedMinutes, int Entries, bool HasOpenEntry, IReadOnlyList<TimesheetDayDto> Days);

public sealed record TimesheetDto(DateOnly From, DateOnly To, IReadOnlyList<TimesheetRowDto> Rows, int TotalWorkedMinutes, int TotalPlannedMinutes);

/// <summary><c>GET /staff/timesheet?from&amp;to&amp;userId</c>: local branch dates (inclusive, ≤ 366 days; default today).</summary>
public sealed record TimesheetQuery : ReportPeriodQuery
{
    public Guid? UserId { get; init; }
}

public sealed class TimesheetQueryValidator : FluentValidation.AbstractValidator<TimesheetQuery>
{
    public TimesheetQueryValidator() => ReportPeriodRules.Apply(this);
}

/// <summary>
/// Hours per employee per local day of the current branch: worked = Σ entries by clock-in local date (open entries count until now),
/// planned = Σ scheduled shifts by shift date. Employees appear if they have either.
/// </summary>
public sealed class TimesheetHandler(IApplicationDbContext db, IClock clock, ReportScope scope, StaffDirectory directory)
    : IHandler<TimesheetQuery, TimesheetDto>
{
    public async Task<Result<TimesheetDto>> HandleAsync(TimesheetQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var now = clock.UtcNow;
        var entries = await db.TimeEntries.AsNoTracking()
            .Where(e => e.BranchId == ctx.BranchId && e.ClockInAt >= ctx.Utc.FromUtc && e.ClockInAt < ctx.Utc.ToUtc
                        && (request.UserId == null || e.UserId == request.UserId))
            .ToListAsync(cancellationToken);
        var shifts = await db.ShiftSchedules.AsNoTracking()
            .Where(s => s.BranchId == ctx.BranchId && s.Date >= ctx.From && s.Date <= ctx.To
                        && (request.UserId == null || s.UserId == request.UserId))
            .ToListAsync(cancellationToken);

        var worked = entries.Select(e => (e.UserId, Date: BranchTime.LocalDate(e.ClockInAt, ctx.Zone), Minutes: e.WorkedMinutes(now)));
        var planned = shifts.Select(s => (s.UserId, s.Date, Minutes: s.PlannedMinutes));
        var userIds = entries.Select(e => e.UserId).Concat(shifts.Select(s => s.UserId)).Distinct().ToList();
        var names = await directory.NamesAsync(userIds, cancellationToken);

        var workedByKey = worked.GroupBy(x => (x.UserId, x.Date)).ToDictionary(g => g.Key, g => g.Sum(x => x.Minutes));
        var plannedByKey = planned.GroupBy(x => (x.UserId, x.Date)).ToDictionary(g => g.Key, g => g.Sum(x => x.Minutes));
        var rows = userIds.Select(userId =>
            {
                var days = workedByKey.Keys.Concat(plannedByKey.Keys).Where(k => k.UserId == userId).Select(k => k.Date).Distinct()
                    .Order()
                    .Select(date => new TimesheetDayDto(
                        date, workedByKey.GetValueOrDefault((userId, date)), plannedByKey.GetValueOrDefault((userId, date))))
                    .ToList();
                var userEntries = entries.Where(e => e.UserId == userId).ToList();
                return new TimesheetRowDto(
                    userId, names.GetValueOrDefault(userId), days.Sum(d => d.WorkedMinutes), days.Sum(d => d.PlannedMinutes),
                    userEntries.Count, userEntries.Any(e => e.IsOpen), days);
            })
            .OrderBy(r => r.FullName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        return new TimesheetDto(ctx.From, ctx.To, rows, rows.Sum(r => r.WorkedMinutes), rows.Sum(r => r.PlannedMinutes));
    }
}

/// <summary><c>GET /staff/timesheet/export</c>: one CSV row per employee per day + a total row per employee (hours, 2 decimals).</summary>
public sealed class ExportTimesheetHandler(TimesheetHandler timesheet) : IHandler<TimesheetQuery, ReportFile>
{
    private static readonly string[] Headers = ["employee", "date", "planned_hours", "worked_hours", "difference_hours"];

    public async Task<Result<ReportFile>> HandleAsync(TimesheetQuery request, CancellationToken cancellationToken)
    {
        var result = await timesheet.HandleAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return result.Error;
        }

        var sheet = result.Value;
        var rows = new List<IReadOnlyList<object?>>();
        foreach (var row in sheet.Rows)
        {
            var name = row.FullName ?? row.UserId.ToString();
            rows.AddRange(row.Days.Select(d => Row(name, d.Date, d.PlannedMinutes, d.WorkedMinutes)));
            rows.Add(Row(name, "total", row.PlannedMinutes, row.WorkedMinutes));
        }

        var content = CsvWriter.Write(Headers, rows);
        return new ReportFile($"timesheet_{sheet.From:yyyy-MM-dd}_{sheet.To:yyyy-MM-dd}.csv", CsvWriter.ContentType, content);
    }

    private static object?[] Row(string name, object date, int planned, int worked) =>
        [name, date, Hours(planned), Hours(worked), Hours(worked - planned)];

    /// <summary>Hours with exactly two decimals (adding 0.00m fixes the decimal scale, e.g. 8 → 8.00).</summary>
    private static decimal Hours(int minutes) => Money.Round(minutes / 60m) + 0.00m;
}
