using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Notifications;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using static System.FormattableString;

namespace Restaurant.Application.Features.Notifications.EventHandlers;

/// <summary><see cref="StockLowDomainEvent"/> → <c>stock_low</c> for branch users with <c>inventory.read</c>.</summary>
public sealed class StockLowNotificationHandler(IApplicationDbContext db, INotificationPublisher publisher)
    : IDomainEventHandler<StockLowDomainEvent>
{
    public async Task HandleAsync(StockLowDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var ingredient = db.Ingredients.Local.FirstOrDefault(i => i.Id == domainEvent.IngredientId)
                         ?? await db.Ingredients.IgnoreQueryFilters().AsNoTracking()
                             .FirstOrDefaultAsync(i => i.Id == domainEvent.IngredientId, cancellationToken);
        if (ingredient is null)
        {
            return;
        }

        var message = new NotificationMessage(
            ingredient.OrganizationId, domainEvent.BranchId, NotificationType.StockLow,
            $"Низкий остаток: {ingredient.Name}",
            Invariant($"Остаток {domainEvent.Quantity:0.###} при минимуме {domainEvent.MinQuantity:0.###}"),
            "/stock");
        await publisher.PublishToPermissionAsync(message, Permissions.Inventory.Read, null, cancellationToken);
    }
}

/// <summary><see cref="PurchaseReceivedDomainEvent"/> → <c>purchase_received</c> for branch users with <c>purchases.read</c> (except the actor).</summary>
public sealed class PurchaseReceivedNotificationHandler(IApplicationDbContext db, INotificationPublisher publisher, ITenantContext tenant)
    : IDomainEventHandler<PurchaseReceivedDomainEvent>
{
    public async Task HandleAsync(PurchaseReceivedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var purchase = db.PurchaseOrders.Local.FirstOrDefault(p => p.Id == domainEvent.PurchaseOrderId)
                       ?? await db.PurchaseOrders.IgnoreQueryFilters().AsNoTracking()
                           .FirstOrDefaultAsync(p => p.Id == domainEvent.PurchaseOrderId, cancellationToken);
        if (purchase is null)
        {
            return;
        }

        var supplier = await db.Suppliers.IgnoreQueryFilters()
            .Where(s => s.Id == purchase.SupplierId)
            .Select(s => s.Name)
            .FirstOrDefaultAsync(cancellationToken);
        var message = new NotificationMessage(
            purchase.OrganizationId, domainEvent.BranchId, NotificationType.PurchaseReceived,
            Invariant($"Поставка принята: №{purchase.Number}"), supplier, Invariant($"/stock/purchases/{purchase.Id}"));
        await publisher.PublishToPermissionAsync(message, Permissions.Purchases.Read, tenant.UserId, cancellationToken);
    }
}
