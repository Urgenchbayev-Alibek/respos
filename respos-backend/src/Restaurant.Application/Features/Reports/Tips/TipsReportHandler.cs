using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Tips;

public sealed record TipsByWaiterDto(Guid WaiterId, string? WaiterName, decimal TipsAmount, int PaymentsCount);

public sealed record TipsReportDto(DateOnly From, DateOnly To, decimal TotalTips, IReadOnlyList<TipsByWaiterDto> Rows);

public sealed record TipsReportQuery : ReportPeriodQuery;

public sealed class TipsReportQueryValidator : FluentValidation.AbstractValidator<TipsReportQuery>
{
    public TipsReportQueryValidator() => ReportPeriodRules.Apply(this);
}

/// <summary>
/// <c>GET /reports/tips?from=&amp;to=</c> [reports.read]: Σ payment tips in the period (payment time, branch timezone) per waiter
/// of the order. Tips are not revenue — sales reports never include them.
/// </summary>
public sealed class TipsReportHandler(IApplicationDbContext db, ReportScope scope) : IHandler<TipsReportQuery, TipsReportDto>
{
    public async Task<Result<TipsReportDto>> HandleAsync(TipsReportQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var rows = await (
                from p in db.Payments
                join o in db.Orders on p.OrderId equals o.Id
                where p.BranchId == ctx.BranchId && p.TipAmount > 0 && p.CreatedAt >= ctx.Utc.FromUtc && p.CreatedAt < ctx.Utc.ToUtc
                group p by o.WaiterId into g
                select new { WaiterId = g.Key, Tips = g.Sum(p => p.TipAmount), Count = g.Count() })
            .ToListAsync(cancellationToken);
        var waiterIds = rows.Select(r => r.WaiterId).ToList();
        var names = await db.Users.Where(u => waiterIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);
        var result = rows
            .Select(r => new TipsByWaiterDto(r.WaiterId, names.GetValueOrDefault(r.WaiterId), r.Tips, r.Count))
            .OrderByDescending(r => r.TipsAmount)
            .ToList();
        return new TipsReportDto(ctx.From, ctx.To, result.Sum(r => r.TipsAmount), result);
    }
}
