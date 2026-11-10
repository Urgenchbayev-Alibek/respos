using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Delivery.Common;

/// <summary>Builds <see cref="DeliveryOrderDto"/>s for the current branch and queues <c>DeliveryUpdated</c>.</summary>
[ScopedService]
public sealed class DeliveryReadService(IApplicationDbContext db, ITenantContext tenant, IClock clock, IRealtimeNotifier realtime)
{
    public const int MaxBoardSize = 300;

    /// <summary>Deliveries of the current branch (tenant filter + branch filter), read-only.</summary>
    public IQueryable<OrderDelivery> BranchDeliveries()
    {
        var branchId = tenant.RequireBranchId();
        return db.OrderDeliveries.AsNoTracking().Where(d => d.BranchId == branchId);
    }

    /// <summary>Tracked delivery of the current branch by order id (null → 404, also for other tenants).</summary>
    public Task<OrderDelivery?> LoadAsync(Guid orderId, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        return db.OrderDeliveries.FirstOrDefaultAsync(d => d.OrderId == orderId && d.BranchId == branchId, ct);
    }

    public async Task<DeliveryOrderDto?> GetAsync(Guid orderId, CancellationToken ct) =>
        (await MapAsync(await BranchDeliveries().Where(d => d.OrderId == orderId).ToListAsync(ct), ct)).FirstOrDefault();

    public async Task<IReadOnlyList<DeliveryOrderDto>> MapAsync(IReadOnlyList<OrderDelivery> deliveries, CancellationToken ct)
    {
        if (deliveries.Count == 0)
        {
            return [];
        }

        var orderIds = deliveries.Select(d => d.OrderId).ToList();
        var orders = await db.Orders.AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .Include(o => o.Items)
            .ToDictionaryAsync(o => o.Id, ct);
        var courierIds = deliveries.Where(d => d.CourierId.HasValue).Select(d => d.CourierId!.Value).Distinct().ToList();
        var couriers = await db.Couriers.AsNoTracking()
            .Where(c => courierIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, CourierDto.From, ct);
        return deliveries
            .Where(d => orders.ContainsKey(d.OrderId))
            .Select(d => Map(d, orders[d.OrderId], d.CourierId is { } id ? couriers.GetValueOrDefault(id) : null))
            .ToList();
    }

    public void NotifyUpdated(OrderDelivery delivery) =>
        realtime.ToBranch(delivery.BranchId, RealtimeEvents.DeliveryUpdated, new
        {
            orderId = delivery.OrderId,
            status = delivery.Status,
            courierId = delivery.CourierId,
            branchId = delivery.BranchId,
            occurredAt = clock.UtcNow,
        });

    private static DeliveryOrderDto Map(OrderDelivery d, Order o, CourierDto? courier) => new(
        o.Id, o.Number, $"#{o.Number:0000}", o.Status, d.Status, OrderDelivery.TargetsFrom(d.Status),
        d.CustomerName, d.CustomerPhone, d.Address, d.Entrance, d.Floor, d.Apartment, d.Comment, courier,
        o.Items.Where(i => i.Status != OrderItemStatus.Cancelled)
            .OrderBy(i => i.NameSnapshot)
            .Select(i => new DeliveryItemDto(i.Id, i.NameSnapshot, i.VariantNameSnapshot, i.Quantity, i.Status, i.LineTotal))
            .ToList(),
        o.Subtotal, o.DiscountAmount, o.DeliveryFee, o.Total, o.PaidAmount, o.RemainingAmount,
        d.CreatedAt, d.StatusChangedAt, d.AcceptedAt, d.CookingAt, d.ReadyAt, d.OnTheWayAt, d.DeliveredAt, d.CancelledAt, d.CancelReason);
}
