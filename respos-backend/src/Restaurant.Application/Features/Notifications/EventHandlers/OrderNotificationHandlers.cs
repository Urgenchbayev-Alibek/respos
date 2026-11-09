using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Notifications;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using static System.FormattableString;

namespace Restaurant.Application.Features.Notifications.EventHandlers;

/// <summary><see cref="OrderSubmittedDomainEvent"/> → <c>order_new</c> for branch kitchen staff (<c>kitchen.status.update</c>, except the actor) — waiters are not spammed.</summary>
public sealed class OrderSubmittedNotificationHandler(IApplicationDbContext db, INotificationPublisher publisher, ITenantContext tenant)
    : IDomainEventHandler<OrderSubmittedDomainEvent>
{
    public async Task HandleAsync(OrderSubmittedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await OrderLookup.FindAsync(db, domainEvent.OrderId, cancellationToken);
        if (order is null)
        {
            return;
        }

        var place = await OrderLookup.PlaceAsync(db, order, cancellationToken);
        var message = new NotificationMessage(
            order.OrganizationId, domainEvent.BranchId, NotificationType.OrderNew,
            Invariant($"Новый заказ #{order.Number:D4}"), place, "/kitchen");
        await publisher.PublishToPermissionAsync(message, Permissions.Kitchen.StatusUpdate, tenant.UserId, cancellationToken);
    }
}

/// <summary><see cref="OrderItemReadyDomainEvent"/> → <c>order_ready</c> to the order's waiter.</summary>
public sealed class OrderItemReadyNotificationHandler(IApplicationDbContext db, INotificationPublisher publisher)
    : IDomainEventHandler<OrderItemReadyDomainEvent>
{
    public async Task HandleAsync(OrderItemReadyDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await OrderLookup.FindAsync(db, domainEvent.OrderId, cancellationToken);
        if (order is null)
        {
            return;
        }

        var itemName = order.Items.FirstOrDefault(i => i.Id == domainEvent.OrderItemId)?.NameSnapshot
                       ?? await db.Orders.IgnoreQueryFilters()
                           .Where(o => o.Id == order.Id)
                           .SelectMany(o => o.Items)
                           .Where(i => i.Id == domainEvent.OrderItemId)
                           .Select(i => i.NameSnapshot)
                           .FirstOrDefaultAsync(cancellationToken)
                       ?? string.Empty;
        var place = await OrderLookup.PlaceAsync(db, order, cancellationToken);
        var message = new NotificationMessage(
            order.OrganizationId, domainEvent.BranchId, NotificationType.OrderReady,
            $"Готово: {itemName}", Invariant($"Заказ #{order.Number:D4}, {place}"), "/waiter");
        publisher.PublishToUser(message, order.WaiterId);
    }
}

internal static class OrderLookup
{
    /// <summary>The tracked order of the current unit of work, or the stored one (explicit id, no tenant filter).</summary>
    public static async Task<Order?> FindAsync(IApplicationDbContext db, Guid orderId, CancellationToken ct) =>
        db.Orders.Local.FirstOrDefault(o => o.Id == orderId)
        ?? await db.Orders.IgnoreQueryFilters().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId, ct);

    public static async Task<string> PlaceAsync(IApplicationDbContext db, Order order, CancellationToken ct)
    {
        if (order.TableId is not { } tableId)
        {
            return "с собой";
        }

        var number = db.DiningTables.Local.FirstOrDefault(t => t.Id == tableId)?.Number
                     ?? await db.DiningTables.IgnoreQueryFilters()
                         .Where(t => t.Id == tableId)
                         .Select(t => t.Number)
                         .FirstOrDefaultAsync(ct);
        return $"стол {number}";
    }
}
