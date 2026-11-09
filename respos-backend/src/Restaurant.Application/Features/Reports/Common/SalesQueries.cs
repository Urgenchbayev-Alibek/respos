using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.Common;

/// <summary>
/// Shared, server-side (SQL) sales aggregations. Revenue rules:
/// only <c>paid</c> orders count, grouped by <see cref="Order.BusinessDate"/> (branch-local day);
/// revenue = Σ order.Total − Σ refunds of those orders; cancelled items are excluded from item stats.
/// </summary>
public static class SalesQueries
{
    public sealed record DayTotals(DateOnly Date, decimal Gross, int Orders);

    public sealed record DayAmount(DateOnly Date, decimal Amount);

    public static IQueryable<Order> PaidOrders(this IApplicationDbContext db, Guid branchId, DateOnly from, DateOnly to) =>
        db.Orders.Where(o => o.BranchId == branchId
                             && o.Status == OrderStatus.Paid
                             && o.BusinessDate >= from
                             && o.BusinessDate <= to);

    public static IQueryable<OrderItem> SoldItems(this IQueryable<Order> orders) =>
        orders.SelectMany(o => o.Items).Where(i => i.Status != OrderItemStatus.Cancelled);

    /// <summary>Per-day revenue and order count (zero-filled for every day of the period).</summary>
    public static async Task<IReadOnlyList<SalesDayDto>> SalesByDayAsync(
        this IApplicationDbContext db, Guid branchId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var paid = db.PaidOrders(branchId, from, to);
        var gross = await paid
            .GroupBy(o => o.BusinessDate)
            .Select(g => new DayTotals(g.Key, g.Sum(o => o.Total), g.Count()))
            .ToDictionaryAsync(d => d.Date, ct);
        var refunds = await (
                from r in db.Refunds
                join p in db.Payments on r.PaymentId equals p.Id
                join o in paid on p.OrderId equals o.Id
                group r.Amount by o.BusinessDate into g
                select new DayAmount(g.Key, g.Sum()))
            .ToDictionaryAsync(d => d.Date, d => d.Amount, ct);

        var days = new List<SalesDayDto>(to.DayNumber - from.DayNumber + 1);
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var totals = gross.GetValueOrDefault(day);
            var revenue = (totals?.Gross ?? 0m) - refunds.GetValueOrDefault(day);
            days.Add(new SalesDayDto(day, revenue, totals?.Orders ?? 0));
        }

        return days;
    }

    public static async Task<IReadOnlyList<TopItemDto>> TopItemsAsync(
        this IApplicationDbContext db, Guid branchId, DateOnly from, DateOnly to, int limit, CancellationToken ct)
    {
        var rows = await db.PaidOrders(branchId, from, to).SoldItems()
            .GroupBy(i => i.MenuItemId)
            .Select(g => new { MenuItemId = g.Key, Name = g.Max(i => i.NameSnapshot), Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .OrderByDescending(x => x.Quantity).ThenByDescending(x => x.Revenue)
            .Take(limit)
            .ToListAsync(ct);
        return rows.Select(x => new TopItemDto(x.MenuItemId, x.Name ?? string.Empty, x.Quantity, x.Revenue)).ToList();
    }
}
