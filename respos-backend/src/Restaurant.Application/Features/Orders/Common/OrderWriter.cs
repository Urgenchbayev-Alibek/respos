using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>Shared write-side helpers of the order use cases: load aggregate, branch pricing/time, realtime, save + read back.</summary>
[ScopedService]
public sealed class OrderWriter(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, IRealtimeNotifier realtime, OrderReadService reader)
{
    private const int MaxNumberAttempts = 5;
    private const string UniqueViolation = "23505";

    /// <summary>Tracked order of the current branch with items + modifiers (null → 404, also for other tenants).</summary>
    public Task<Order?> LoadAsync(Guid orderId, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        return db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == orderId && o.BranchId == branchId, ct);
    }

    /// <summary>Branch service/tax percents (BranchSettings) as the domain pricing snapshot.</summary>
    public async Task<OrderPricingSettings> PricingAsync(CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var settings = await db.BranchSettings.AsNoTracking()
            .Where(s => s.BranchId == branchId)
            .Select(s => new OrderPricingSettings(s.ServiceChargePercent, s.TaxPercent))
            .FirstOrDefaultAsync(ct);
        return settings ?? OrderPricingSettings.None;
    }

    /// <summary>Current local time in the branch timezone (business date, menu availability windows).</summary>
    public async Task<DateTime> BranchLocalNowAsync(CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var timezone = await db.Branches.AsNoTracking()
            .Where(b => b.Id == branchId)
            .Select(b => b.Timezone)
            .FirstOrDefaultAsync(ct);
        var zone = TimeZoneInfo.TryFindSystemTimeZoneById(timezone ?? RestaurantBranch.DefaultTimezone, out var found)
            ? found
            : TimeZoneInfo.Utc;
        return TimeZoneInfo.ConvertTimeFromUtc(clock.UtcNow, zone);
    }

    public async Task<int> NextNumberAsync(DateOnly businessDate, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var max = await db.Orders.IgnoreQueryFilters()
            .Where(o => o.BranchId == branchId && o.BusinessDate == businessDate)
            .MaxAsync(o => (int?)o.Number, ct);
        return (max ?? 0) + 1;
    }

    public void NotifyOrderUpdated(Order order) =>
        realtime.ToBranch(order.BranchId, RealtimeEvents.OrderUpdated, new
        {
            orderId = order.Id,
            status = order.Status,
            tableId = order.TableId,
            branchId = order.BranchId,
            occurredAt = clock.UtcNow,
        });

    /// <summary>
    /// Saves a newly added order; the unique index (branch, business date, number) + renumber-and-retry make the
    /// sequential number concurrency-safe.
    /// </summary>
    public async Task SaveNewOrderAsync(Order order, DateOnly businessDate, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException ex) when (attempt < MaxNumberAttempts && ex.InnerException is DbException { SqlState: UniqueViolation })
            {
                order.Renumber(await NextNumberAsync(businessDate, ct));
            }
        }
    }

    /// <summary>Commits the unit of work and returns the fresh DTO.</summary>
    public async Task<Result<OrderDto>> SaveAndReadAsync(Order order, CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        return await ReadAsync(order.Id, ct);
    }

    public async Task<Result<OrderDto>> ReadAsync(Guid orderId, CancellationToken ct)
    {
        var dto = await reader.GetAsync(orderId, ct);
        return dto is null ? OrderErrors.NotFound : dto;
    }
}
