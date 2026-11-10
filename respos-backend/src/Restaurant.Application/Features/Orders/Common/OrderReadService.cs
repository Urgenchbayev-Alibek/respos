using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>Builds <see cref="OrderDto"/>s (items, payments, history, table/waiter names) for the current branch.</summary>
[ScopedService]
public sealed class OrderReadService(IApplicationDbContext db, ITenantContext tenant, UserNameLookup users)
{
    public static readonly OrderStatus[] ClosedStatuses = [OrderStatus.Paid, OrderStatus.Cancelled];

    /// <summary>Orders of the current branch (tenant filter + branch filter).</summary>
    public IQueryable<Order> BranchOrders()
    {
        var branchId = tenant.RequireBranchId();
        return db.Orders.AsNoTracking().Where(o => o.BranchId == branchId);
    }

    public async Task<OrderDto?> GetAsync(Guid orderId, CancellationToken ct) =>
        (await GetManyAsync([orderId], ct)).FirstOrDefault();

    /// <summary>Returns DTOs in the order of <paramref name="orderIds"/> (unknown ids are skipped).</summary>
    public async Task<IReadOnlyList<OrderDto>> GetManyAsync(IReadOnlyList<Guid> orderIds, CancellationToken ct)
    {
        if (orderIds.Count == 0)
        {
            return [];
        }

        var orders = await BranchOrders()
            .Where(o => orderIds.Contains(o.Id))
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.History)
            .AsSplitQuery()
            .ToListAsync(ct);
        var payments = await db.Payments.AsNoTracking()
            .Where(p => orderIds.Contains(p.OrderId))
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(ct);
        var tableIds = orders.Where(o => o.TableId.HasValue).Select(o => o.TableId!.Value).Distinct().ToList();
        var tables = await db.DiningTables.AsNoTracking()
            .Where(t => tableIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Number })
            .ToDictionaryAsync(t => t.Id, t => t.Number, ct);
        var names = await users.GetAsync(
            orders.Select(o => (Guid?)o.WaiterId)
                .Concat(orders.SelectMany(o => o.History.Select(h => h.ChangedBy)))
                .Concat(payments.Select(p => p.CreatedBy)),
            ct);

        var paymentsByOrder = payments.ToLookup(p => p.OrderId);
        var byId = orders.ToDictionary(o => o.Id);
        return orderIds
            .Where(byId.ContainsKey)
            .Select(id => Map(byId[id], tables, names, paymentsByOrder[id].Select(p => PaymentDto.From(p, names, byId[id].Number)).ToList()))
            .ToList();
    }

    private static OrderDto Map(
        Order o, IReadOnlyDictionary<Guid, string> tables, IReadOnlyDictionary<Guid, string> names, IReadOnlyList<PaymentDto> payments) => new(
        o.Id, o.Number, o.BusinessDate, o.Type, o.Status, o.TableId,
        o.TableId is { } tableId ? tables.GetValueOrDefault(tableId) : null,
        o.WaiterId, names.GetValueOrDefault(o.WaiterId), o.GuestCount,
        o.Items.OrderBy(i => i.SentAt ?? DateTime.MaxValue).ThenBy(i => i.NameSnapshot).Select(MapItem).ToList(),
        o.Subtotal, o.DiscountType, o.DiscountValue, o.DiscountAmount, o.ServiceChargeAmount, o.TaxAmount, o.Total,
        o.PaidAmount, o.RemainingAmount, o.Comment, o.CancelReason, o.OpenedAt, o.ClosedAt, payments,
        o.History.OrderBy(h => h.ChangedAt)
            .Select(h => new OrderHistoryDto(h.FromStatus, h.ToStatus, h.ChangedBy is { } by ? names.GetValueOrDefault(by) : null, h.ChangedAt, h.Reason))
            .ToList())
    {
        DeliveryFee = o.DeliveryFee,
    };

    public static OrderItemDto MapItem(OrderItem i) => new(
        i.Id, i.MenuItemId, i.VariantId, i.NameSnapshot, i.VariantNameSnapshot, i.UnitPrice, i.Quantity,
        i.Modifiers.Select(m => new OrderItemModifierDto(m.NameSnapshot, m.PriceDelta)).ToList(),
        i.Comment, i.Status, i.LineTotal, i.KitchenStationId, i.SentAt, i.ReadyAt, i.CancelReason);
}
