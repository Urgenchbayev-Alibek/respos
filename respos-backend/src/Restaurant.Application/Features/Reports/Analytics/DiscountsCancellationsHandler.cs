using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>
/// <c>GET /reports/discounts-cancellations?from=&amp;to=</c> (business date, SQL aggregates).
/// Discounts: paid orders with discountAmount &gt; 0 (total, per waiter, the <see cref="MaxOrders"/> largest orders).
/// Cancellations: whole cancelled orders (amount = Σ their line totals) and cancelled lines of orders that were not
/// cancelled as a whole; grouped by reason and by waiter (order owner).
/// </summary>
public sealed class DiscountsCancellationsHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, DiscountsCancellationsDto>
{
    public const int MaxOrders = 100;

    private sealed record Group(Guid WaiterId, string Reason, int Orders, int Items, decimal Amount);

    public async Task<Result<DiscountsCancellationsDto>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var discounted = db.PaidOrders(ctx.BranchId, ctx.From, ctx.To).Where(o => o.DiscountAmount > 0);
        var periodOrders = db.Orders.Where(o => o.BranchId == ctx.BranchId && o.BusinessDate >= ctx.From && o.BusinessDate <= ctx.To);
        var cancelled = periodOrders.Where(o => o.Status == OrderStatus.Cancelled);

        var discountByWaiter = await discounted.GroupBy(o => o.WaiterId)
            .Select(g => new { WaiterId = g.Key, Count = g.Count(), Amount = g.Sum(o => o.DiscountAmount) })
            .ToListAsync(cancellationToken);
        var topOrders = await discounted.OrderByDescending(o => o.DiscountAmount).ThenBy(o => o.BusinessDate).ThenBy(o => o.Number)
            .Take(MaxOrders)
            .Select(o => new { o.Id, o.Number, o.BusinessDate, o.WaiterId, o.DiscountType, o.DiscountValue, o.Subtotal, o.DiscountAmount, o.Total })
            .ToListAsync(cancellationToken);

        var orderCounts = await cancelled.GroupBy(o => new { o.WaiterId, o.CancelReason })
            .Select(g => new { g.Key.WaiterId, g.Key.CancelReason, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var orderAmounts = await (
                from o in cancelled
                from i in o.Items
                group i.LineTotal by new { o.WaiterId, o.CancelReason } into g
                select new { g.Key.WaiterId, g.Key.CancelReason, Amount = g.Sum() })
            .ToListAsync(cancellationToken);
        var itemGroups = await (
                from o in periodOrders
                where o.Status != OrderStatus.Cancelled
                from i in o.Items
                where i.Status == OrderItemStatus.Cancelled
                group i.LineTotal by new { o.WaiterId, i.CancelReason } into g
                select new { g.Key.WaiterId, g.Key.CancelReason, Count = g.Count(), Amount = g.Sum() })
            .ToListAsync(cancellationToken);

        var orderGroups = orderCounts.Select(c => new Group(c.WaiterId, Reason(c.CancelReason), c.Count, 0,
            orderAmounts.Where(a => a.WaiterId == c.WaiterId && a.CancelReason == c.CancelReason).Sum(a => a.Amount))).ToList();
        var lineGroups = itemGroups.Select(i => new Group(i.WaiterId, Reason(i.CancelReason), 0, i.Count, i.Amount)).ToList();
        var all = orderGroups.Concat(lineGroups).ToList();

        var waiterIds = all.Select(g => g.WaiterId).Concat(discountByWaiter.Select(d => d.WaiterId)).Concat(topOrders.Select(o => o.WaiterId))
            .Distinct().ToList();
        var names = await db.Users.Where(u => waiterIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);
        string Name(Guid id) => names.GetValueOrDefault(id, string.Empty);

        var discounts = new DiscountsSummaryDto(
            discountByWaiter.Sum(d => d.Count),
            discountByWaiter.Sum(d => d.Amount),
            discountByWaiter.Select(d => new StaffAmountDto(d.WaiterId, Name(d.WaiterId), d.Count, d.Amount))
                .OrderByDescending(d => d.Amount).ToList(),
            topOrders.Select(o => new DiscountedOrderDto(o.Id, o.Number, o.BusinessDate, names.GetValueOrDefault(o.WaiterId), o.DiscountType,
                o.DiscountValue, o.Subtotal, o.DiscountAmount, o.Total)).ToList());

        var cancellations = new CancellationsSummaryDto(
            orderGroups.Sum(g => g.Orders),
            orderGroups.Sum(g => g.Amount),
            lineGroups.Sum(g => g.Items),
            lineGroups.Sum(g => g.Amount),
            all.GroupBy(g => g.Reason)
                .Select(g => new CancelReasonDto(g.Key, g.Sum(x => x.Orders), g.Sum(x => x.Items), g.Sum(x => x.Amount)))
                .OrderByDescending(r => r.Amount).ThenBy(r => r.Reason, StringComparer.CurrentCulture).ToList(),
            all.GroupBy(g => g.WaiterId)
                .Select(g => new StaffAmountDto(g.Key, Name(g.Key), g.Sum(x => x.Orders + x.Items), g.Sum(x => x.Amount)))
                .OrderByDescending(w => w.Amount).ToList());

        return new DiscountsCancellationsDto(discounts, cancellations);
    }

    private static string Reason(string? reason) => reason?.Trim() ?? string.Empty;
}
