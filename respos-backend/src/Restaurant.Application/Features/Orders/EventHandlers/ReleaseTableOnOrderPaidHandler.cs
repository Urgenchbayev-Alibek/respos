using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Events;

namespace Restaurant.Application.Features.Orders.EventHandlers;

/// <summary>Fully paid order → its table becomes available (unless another active order is on it). Same transaction.</summary>
public sealed class ReleaseTableOnOrderPaidHandler(TableOccupancy tables) : IDomainEventHandler<OrderPaidDomainEvent>
{
    public Task HandleAsync(OrderPaidDomainEvent domainEvent, CancellationToken cancellationToken) =>
        tables.ReleaseIfFreeAsync(domainEvent.TableId, domainEvent.OrderId, cancellationToken);
}
