using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.CancelOrder;

public sealed record CancelOrderCommand(string Reason)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class CancelOrderValidator : AbstractValidator<CancelOrderCommand>
{
    public CancelOrderValidator() => RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
}

/// <summary>
/// <c>POST /orders/{id}/cancel</c> [orders.cancel]: any non-terminal order with nothing paid (else 422
/// <c>order.has_payments</c>); cancels open tickets, frees the table; audited.
/// </summary>
public sealed class CancelOrderHandler(
    ITenantContext tenant, IClock clock, IAuditLogger audit, OrderWriter writer, KitchenTicketSync kitchen, TableOccupancy tables)
    : IHandler<CancelOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var reason = request.Reason.Trim();
        var fromStatus = order.Status;
        order.Cancel(reason, userId, clock.UtcNow);
        await kitchen.CancelOrderTicketsAsync(order, cancellationToken);
        await tables.ReleaseIfFreeAsync(order.TableId, order.Id, cancellationToken);
        audit.Log("order.cancelled", nameof(Order), order.Id, new { order.Number, fromStatus, reason, order.Total });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
