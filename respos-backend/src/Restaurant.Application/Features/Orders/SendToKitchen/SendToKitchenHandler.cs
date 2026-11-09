using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.SendToKitchen;

/// <summary><c>ItemIds</c> null or empty = all <c>new</c> items.</summary>
public sealed record SendToKitchenCommand(IReadOnlyList<Guid>? ItemIds)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class SendToKitchenValidator : AbstractValidator<SendToKitchenCommand>
{
    public SendToKitchenValidator() =>
        RuleFor(x => x.ItemIds).Must(ids => ids is null || ids.Count <= AddItemRequestValidator.MaxItemsPerRequest);
}

/// <summary>
/// <c>POST /orders/{id}/send-to-kitchen</c> (Idempotency-Key): marks new items <c>sent</c>, creates one kitchen ticket per
/// station, recomputes the order status and raises <c>OrderSubmittedDomainEvent</c>. Realtime after commit:
/// <c>KitchenTicketCreated</c> (kitchen + station) and <c>OrderUpdated</c>.
/// </summary>
public sealed class SendToKitchenHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, OrderWriter writer, KitchenTicketSync kitchen)
    : IHandler<SendToKitchenCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(SendToKitchenCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var itemIds = request.ItemIds is { Count: > 0 } ids ? ids.ToHashSet() : null;
        var sent = order.SendItems(itemIds, userId, clock.UtcNow);
        await kitchen.CreateTicketsAsync(order, sent, await TableLabelAsync(order, cancellationToken), cancellationToken);
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }

    private async Task<string> TableLabelAsync(Order order, CancellationToken ct)
    {
        if (order.TableId is { } tableId)
        {
            var number = await db.DiningTables.AsNoTracking().Where(t => t.Id == tableId).Select(t => t.Number).FirstOrDefaultAsync(ct);
            if (number is not null)
            {
                return number;
            }
        }

        return $"#{order.Number:0000}";
    }
}
