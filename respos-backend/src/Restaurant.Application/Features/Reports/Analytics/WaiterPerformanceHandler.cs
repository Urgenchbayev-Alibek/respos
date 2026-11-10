using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>
/// <c>GET /reports/waiters?from=&amp;to=</c> — per waiter (order owner), by business date, SQL aggregates:
/// paid orders, revenue (Σ total − refunds), average check, items sold (non-cancelled lines of paid orders),
/// cancelled orders, cancelled lines in orders that were not cancelled as a whole, discounts given (Σ discountAmount of paid orders).
/// <c>tipsAmount</c> = 0: payments have no tip column yet (F2 adds it; then sum it here by order waiter).
/// </summary>
public sealed class WaiterPerformanceHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, IReadOnlyList<WaiterPerformanceDto>>
{
    public async Task<Result<IReadOnlyList<WaiterPerformanceDto>>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var paid = db.PaidOrders(ctx.BranchId, ctx.From, ctx.To);
        var periodOrders = db.Orders.Where(o => o.BranchId == ctx.BranchId && o.BusinessDate >= ctx.From && o.BusinessDate <= ctx.To);

        var sales = await paid.GroupBy(o => o.WaiterId)
            .Select(g => new { WaiterId = g.Key, Orders = g.Count(), Gross = g.Sum(o => o.Total), Discounts = g.Sum(o => o.DiscountAmount) })
            .ToDictionaryAsync(x => x.WaiterId, cancellationToken);
        var refunds = await (
                from r in db.Refunds
                join p in db.Payments on r.PaymentId equals p.Id
                join o in paid on p.OrderId equals o.Id
                group r.Amount by o.WaiterId into g
                select new { WaiterId = g.Key, Amount = g.Sum() })
            .ToDictionaryAsync(x => x.WaiterId, x => x.Amount, cancellationToken);
        var items = await (
                from o in paid
                from i in o.Items
                where i.Status != OrderItemStatus.Cancelled
                group i.Quantity by o.WaiterId into g
                select new { WaiterId = g.Key, Quantity = g.Sum() })
            .ToDictionaryAsync(x => x.WaiterId, x => x.Quantity, cancellationToken);
        var cancelledOrders = await periodOrders.Where(o => o.Status == OrderStatus.Cancelled)
            .GroupBy(o => o.WaiterId)
            .Select(g => new { WaiterId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.WaiterId, x => x.Count, cancellationToken);
        var cancelledItems = await (
                from o in periodOrders
                where o.Status != OrderStatus.Cancelled
                from i in o.Items
                where i.Status == OrderItemStatus.Cancelled
                group i by o.WaiterId into g
                select new { WaiterId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.WaiterId, x => x.Count, cancellationToken);

        var waiterIds = sales.Keys.Union(cancelledOrders.Keys).Union(cancelledItems.Keys).ToList();
        var names = await db.Users.Where(u => waiterIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        IReadOnlyList<WaiterPerformanceDto> result = waiterIds
            .Select(id =>
            {
                var s = sales.GetValueOrDefault(id);
                var revenue = (s?.Gross ?? 0m) - refunds.GetValueOrDefault(id);
                var orders = s?.Orders ?? 0;
                return new WaiterPerformanceDto(
                    id, names.GetValueOrDefault(id, string.Empty), orders, revenue, ReportMath.AverageCheck(revenue, orders),
                    items.GetValueOrDefault(id), cancelledOrders.GetValueOrDefault(id), cancelledItems.GetValueOrDefault(id),
                    s?.Discounts ?? 0m, TipsAmount: 0m);
            })
            .OrderByDescending(w => w.Revenue).ThenBy(w => w.Name, StringComparer.CurrentCulture)
            .ToList();
        return Result.Success(result);
    }
}
