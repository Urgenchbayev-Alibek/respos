using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Delivery.Orders;

public sealed record ChangeDeliveryStatusCommand(DeliveryStatus Status, string? Reason)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class ChangeDeliveryStatusValidator : AbstractValidator<ChangeDeliveryStatusCommand>
{
    public ChangeDeliveryStatusValidator()
    {
        RuleFor(x => x.Status).IsInEnum().NotEqual(DeliveryStatus.New);
        RuleFor(x => x.Reason).MaximumLength(500);
    }
}

/// <summary>
/// <c>POST /delivery/orders/{orderId}/status</c>. Side effects on the order (kitchen flow reused):
/// <c>accepted</c> sends all new items to the kitchen (tickets per station); <c>on_the_way</c> serves ready items and
/// closes their tickets; <c>cancelled</c> cancels the order (reason required, nothing paid) and its open tickets.
/// Invalid transitions → 409 <c>delivery.invalid_status_transition</c>.
/// </summary>
public sealed class ChangeDeliveryStatusHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    IAuditLogger audit,
    OrderWriter writer,
    KitchenTicketSync kitchen,
    DeliveryReadService deliveries) : IHandler<ChangeDeliveryStatusCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> HandleAsync(ChangeDeliveryStatusCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var delivery = await deliveries.LoadAsync(request.OrderId, cancellationToken);
        var order = delivery is null ? null : await writer.LoadAsync(request.OrderId, cancellationToken);
        if (delivery is null || order is null)
        {
            return DeliveryErrors.NotFound;
        }

        var now = clock.UtcNow;
        var from = delivery.Status;
        delivery.ChangeStatus(request.Status, now, request.Reason);
        switch (request.Status)
        {
            case DeliveryStatus.Accepted:
                await SendNewItemsAsync(order, userId, now, cancellationToken);
                break;
            case DeliveryStatus.OnTheWay when order.Items.Any(i => i.Status == OrderItemStatus.Ready):
                order.ServeAllReady(userId, now);
                await kitchen.CloseServedTicketsAsync(order, cancellationToken);
                break;
            case DeliveryStatus.Cancelled:
                if (order.Status != OrderStatus.Cancelled)
                {
                    order.Cancel(delivery.CancelReason!, userId, now);
                    await kitchen.CancelOrderTicketsAsync(order, cancellationToken);
                }

                break;
        }

        audit.Log(new AuditEntry("delivery.status_changed", "order", order.Id.ToString(),
            new { from, to = delivery.Status, request.Reason }) { BranchId = order.BranchId });
        writer.NotifyOrderUpdated(order);
        deliveries.NotifyUpdated(delivery);
        await db.SaveChangesAsync(cancellationToken);
        var dto = await deliveries.GetAsync(order.Id, cancellationToken);
        return dto is null ? DeliveryErrors.NotFound : dto;
    }

    private async Task SendNewItemsAsync(Order order, Guid userId, DateTime now, CancellationToken ct)
    {
        if (order.IsClosed || order.Items.All(i => i.Status != OrderItemStatus.New))
        {
            return;
        }

        var sent = order.SendItems(null, userId, now);
        await kitchen.CreateTicketsAsync(order, sent, $"#{order.Number:0000}", ct);
    }
}
