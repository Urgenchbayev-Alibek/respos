using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;

namespace Restaurant.Application.Features.Delivery.EventHandlers;

/// <summary>
/// Auto-derives delivery <c>ready</c>: when the kitchen marks the last item of a delivery order ready (order status
/// <c>ready</c>/<c>served</c>), an <c>accepted</c> or <c>cooking</c> delivery becomes <c>ready</c> in the same unit of work.
/// Other statuses are left alone (manual flow wins).
/// </summary>
public sealed class DeliveryReadyOnKitchenReadyHandler(IApplicationDbContext db, IClock clock, DeliveryReadService deliveries)
    : IDomainEventHandler<OrderItemReadyDomainEvent>
{
    public async Task HandleAsync(OrderItemReadyDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = db.Orders.Local.FirstOrDefault(o => o.Id == domainEvent.OrderId);
        if (order is not { Type: OrderType.Delivery, Status: OrderStatus.Ready or OrderStatus.Served })
        {
            return;
        }

        var delivery = db.OrderDeliveries.Local.FirstOrDefault(d => d.OrderId == order.Id)
                       ?? await db.OrderDeliveries.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.OrderId == order.Id, cancellationToken);
        if (delivery is not { Status: DeliveryStatus.Accepted or DeliveryStatus.Cooking })
        {
            return;
        }

        delivery.ChangeStatus(DeliveryStatus.Ready, clock.UtcNow);
        deliveries.NotifyUpdated(delivery);
    }
}
