using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Items;

/// <summary><c>ItemId</c> null = serve all ready items (<c>POST /orders/{id}/serve-all</c>).</summary>
public sealed record ServeOrderItemsCommand(Guid OrderId, Guid? ItemId);

/// <summary>
/// <c>POST /orders/{id}/items/{itemId}/serve</c> (ready → served, else 409) and <c>/serve-all</c>.
/// Ready tickets whose items are all served are closed (<c>served</c>).
/// </summary>
public sealed class ServeOrderItemsHandler(ITenantContext tenant, IClock clock, OrderWriter writer, KitchenTicketSync kitchen)
    : IHandler<ServeOrderItemsCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(ServeOrderItemsCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        if (request.ItemId is { } itemId)
        {
            order.ServeItem(itemId, userId, clock.UtcNow);
        }
        else
        {
            order.ServeAllReady(userId, clock.UtcNow);
        }

        await kitchen.CloseServedTicketsAsync(order, cancellationToken);
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
