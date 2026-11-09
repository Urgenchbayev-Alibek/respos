using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Dashboard;

public sealed record DashboardQuery;

public sealed record DashboardShiftDto(Guid Id, DateTime OpenedAt, string? OpenedByName);

public sealed record DashboardTopItemDto(string Name, decimal Quantity, decimal Revenue);

public sealed record DashboardDto(
    decimal SalesToday,
    int OrdersToday,
    decimal AverageCheck,
    int ActiveOrders,
    int TablesOccupied,
    int TablesTotal,
    IReadOnlyList<DashboardTopItemDto> TopItems,
    int LowStockCount,
    DashboardShiftDto? CurrentShift,
    bool IsDemoData);

/// <summary>
/// <c>GET /dashboard</c> (branch, today in branch timezone). Sales = paid orders of today's business date − their refunds.
/// All numbers are aggregated in SQL; <c>isDemoData</c> mirrors <c>Organization.IsDemo</c>.
/// </summary>
public sealed class GetDashboardHandler(IApplicationDbContext db, ITenantContext tenant, ReportScope scope)
    : IHandler<DashboardQuery, DashboardDto>
{
    public const int TopItemsLimit = 5;

    public async Task<Result<DashboardDto>> HandleAsync(DashboardQuery request, CancellationToken cancellationToken)
    {
        var organizationId = tenant.RequireOrganizationId();
        var ctx = await scope.ResolveAsync(null, cancellationToken);
        var branchId = ctx.BranchId;

        var today = await db.SalesByDayAsync(branchId, ctx.Today, ctx.Today, cancellationToken);
        var sales = today.Sum(d => d.Revenue);
        var orders = today.Sum(d => d.Orders);
        var topItems = await db.TopItemsAsync(branchId, ctx.Today, ctx.Today, TopItemsLimit, cancellationToken);

        var activeOrders = await db.Orders.CountAsync(
            o => o.BranchId == branchId && o.Status != OrderStatus.Paid && o.Status != OrderStatus.Cancelled, cancellationToken);
        var tables = await db.DiningTables
            .Where(t => t.BranchId == branchId && t.IsActive && !t.IsArchived)
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Occupied = g.Count(t => t.Status == TableStatus.Occupied) })
            .FirstOrDefaultAsync(cancellationToken);
        var lowStock = await db.StockBalances.CountAsync(
            b => b.BranchId == branchId && !b.Ingredient!.IsArchived && b.Quantity <= b.MinQuantity, cancellationToken);
        var shift = await db.CashShifts
            .Where(s => s.BranchId == branchId && s.Status == CashShiftStatus.Open)
            .OrderByDescending(s => s.OpenedAt)
            .Select(s => new DashboardShiftDto(
                s.Id, s.OpenedAt, db.Users.Where(u => u.Id == s.OpenedBy).Select(u => u.FullName).FirstOrDefault()))
            .FirstOrDefaultAsync(cancellationToken);
        var isDemo = await db.Organizations.Where(o => o.Id == organizationId).Select(o => o.IsDemo).FirstOrDefaultAsync(cancellationToken);

        return new DashboardDto(
            sales,
            orders,
            ReportMath.AverageCheck(sales, orders),
            activeOrders,
            tables?.Occupied ?? 0,
            tables?.Total ?? 0,
            topItems.Select(i => new DashboardTopItemDto(i.Name, i.Quantity, i.Revenue)).ToList(),
            lowStock,
            shift,
            isDemo);
    }
}
