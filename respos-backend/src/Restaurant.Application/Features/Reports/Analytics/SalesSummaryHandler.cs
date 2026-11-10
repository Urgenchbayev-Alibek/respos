using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>
/// <c>GET /reports/sales-summary?from=&amp;to=</c> — sales KPIs of the period and of the previous period of equal length
/// (ending the day before <c>from</c>) with Δ %. Same revenue rule as <c>/reports/sales</c> (paid orders − their refunds).
/// </summary>
public sealed class SalesSummaryHandler(IApplicationDbContext db, ReportScope scope) : IHandler<ReportPeriodQuery, SalesSummaryDto>
{
    public async Task<Result<SalesSummaryDto>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        return await BuildAsync(db, ctx.BranchId, ctx.From, ctx.To, cancellationToken);
    }

    public static async Task<SalesSummaryDto> BuildAsync(
        IApplicationDbContext db, Guid branchId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var (previousFrom, previousTo) = AnalyticsMath.PreviousPeriod(from, to);
        var byDay = await db.SalesByDayAsync(branchId, from, to, ct);
        var previousByDay = await db.SalesByDayAsync(branchId, previousFrom, previousTo, ct);
        var current = await TotalsAsync(db, branchId, from, to, byDay, ct);
        var previous = await TotalsAsync(db, branchId, previousFrom, previousTo, previousByDay, ct);
        return new SalesSummaryDto(from, to, previousFrom, previousTo, current, previous, Deltas(current, previous), byDay, previousByDay);
    }

    public static SalesDeltasDto Deltas(SalesTotalsDto current, SalesTotalsDto previous) => new(
        AnalyticsMath.DeltaPercent(current.Revenue, previous.Revenue),
        AnalyticsMath.DeltaPercent(current.OrdersCount, previous.OrdersCount),
        AnalyticsMath.DeltaPercent(current.AverageCheck, previous.AverageCheck),
        AnalyticsMath.DeltaPercent(current.ItemsSold, previous.ItemsSold),
        AnalyticsMath.DeltaPercent(current.DiscountsAmount, previous.DiscountsAmount),
        AnalyticsMath.DeltaPercent(current.GuestsCount, previous.GuestsCount));

    private static async Task<SalesTotalsDto> TotalsAsync(
        IApplicationDbContext db, Guid branchId, DateOnly from, DateOnly to, IReadOnlyList<SalesDayDto> byDay, CancellationToken ct)
    {
        var paid = db.PaidOrders(branchId, from, to);
        var totals = await paid.GroupBy(_ => 1)
            .Select(g => new { Gross = g.Sum(o => o.Total), Discounts = g.Sum(o => o.DiscountAmount), Guests = g.Sum(o => o.GuestCount) })
            .FirstOrDefaultAsync(ct);
        var items = await paid.SoldItems().SumAsync(i => (decimal?)i.Quantity, ct) ?? 0m;
        var revenue = byDay.Sum(d => d.Revenue);
        var orders = byDay.Sum(d => d.Orders);
        var gross = totals?.Gross ?? 0m;
        return new SalesTotalsDto(revenue, gross, gross - revenue, orders, ReportMath.AverageCheck(revenue, orders), items,
            totals?.Discounts ?? 0m, totals?.Guests ?? 0);
    }
}
