using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Items;

public sealed record CancelOrderItemCommand(string Reason)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }

    [JsonIgnore]
    public Guid ItemId { get; init; }
}

public sealed class CancelOrderItemValidator : AbstractValidator<CancelOrderItemCommand>
{
    public CancelOrderItemValidator() => RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
}

/// <summary>
/// <c>POST /orders/{id}/items/{itemId}/cancel</c>: a <c>new</c> item needs <c>orders.update</c>; an item already sent to the
/// kitchen needs <c>orders.cancel</c> (403 otherwise). Its ticket item is cancelled; audited.
/// </summary>
public sealed class CancelOrderItemHandler(
    ITenantContext tenant, IClock clock, IAuditLogger audit, IPermissionService permissions, OrderWriter writer, KitchenTicketSync kitchen)
    : IHandler<CancelOrderItemCommand, OrderDto>
{
    public static readonly Error CancelSentForbidden =
        Error.Forbidden("auth.forbidden", "Cancelling an item sent to the kitchen requires the orders.cancel permission.");

    public async Task<Result<OrderDto>> HandleAsync(CancelOrderItemCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var item = order.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null)
        {
            return OrderErrors.ItemNotFound;
        }

        var allowed = await permissions.CurrentUserHasAsync(Permissions.Orders.Cancel, cancellationToken)
                      || (!item.WasSent && await permissions.CurrentUserHasAsync(Permissions.Orders.Update, cancellationToken));
        if (!allowed)
        {
            return CancelSentForbidden;
        }

        var wasSent = item.WasSent;
        var reason = request.Reason.Trim();
        order.CancelItem(item.Id, reason, await writer.PricingAsync(cancellationToken), userId, clock.UtcNow);
        if (wasSent)
        {
            await kitchen.CancelOrderItemsAsync(order, [item.Id], cancellationToken);
        }

        audit.Log("order_item.cancelled", nameof(OrderItem), item.Id, new { orderId = order.Id, item.NameSnapshot, item.Quantity, reason, wasSent });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
