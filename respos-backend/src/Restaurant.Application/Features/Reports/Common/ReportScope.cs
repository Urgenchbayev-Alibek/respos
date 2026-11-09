using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Common;

/// <summary>Period filter <c>?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</c> (local branch dates, inclusive; default = today).</summary>
public record ReportPeriodQuery
{
    public const int MaxDays = 366;

    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
}

public sealed class ReportPeriodQueryValidator : AbstractValidator<ReportPeriodQuery>
{
    public ReportPeriodQueryValidator() => ReportPeriodRules.Apply(this);
}

public static class ReportPeriodRules
{
    public static void Apply<T>(AbstractValidator<T> validator)
        where T : ReportPeriodQuery
    {
        validator.RuleFor(x => x.To)
            .Must((q, to) => q.From is null || to is null || to >= q.From)
            .WithErrorCode("report.invalid_period").WithMessage("'to' must not be earlier than 'from'.");
        validator.RuleFor(x => x.To)
            .Must((q, to) => q.From is null || to is null || to.Value.DayNumber - q.From.Value.DayNumber < ReportPeriodQuery.MaxDays)
            .WithErrorCode("report.invalid_period").WithMessage($"The period must not exceed {ReportPeriodQuery.MaxDays} days.");
    }
}

/// <summary>Resolved report context: branch, its timezone, the local period and its UTC interval.</summary>
public sealed record ReportContext(Guid BranchId, TimeZoneInfo Zone, DateOnly From, DateOnly To, UtcRange Utc, DateOnly Today);

/// <summary>Resolves the current branch timezone and the requested period (shared by report/dashboard handlers).</summary>
[ScopedService]
public sealed class ReportScope(IApplicationDbContext db, ITenantContext tenant, IClock clock)
{
    public async Task<ReportContext> ResolveAsync(ReportPeriodQuery? period, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var timezone = await db.Branches.Where(b => b.Id == branchId).Select(b => b.Timezone).FirstOrDefaultAsync(ct);
        var zone = BranchTime.Resolve(timezone);
        var today = BranchTime.LocalDate(clock.UtcNow, zone);
        var from = period?.From ?? period?.To ?? today;
        var to = period?.To ?? (period?.From is not null ? today : from);
        if (to < from)
        {
            to = from;
        }

        return new ReportContext(branchId, zone, from, to, BranchTime.ToUtcRange(from, to, zone), today);
    }
}

public static class ReportMath
{
    /// <summary>revenue / orders, rounded to 2 decimals; 0 when there are no orders.</summary>
    public static decimal AverageCheck(decimal revenue, int orders) => orders == 0 ? 0m : Money.Round(revenue / orders);
}

public static class ReportErrors
{
    public static readonly Error NotFound = Error.NotFound("report.not_found", "Report not found.");

    public static readonly Error UnsupportedFormat =
        Error.Validation("report.unsupported_format", "Only format=csv is supported.");
}
