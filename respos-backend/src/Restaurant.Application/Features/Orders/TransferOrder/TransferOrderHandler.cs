using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.TransferOrder;

public sealed record TransferOrderCommand(Guid TableId)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class TransferOrderValidator : AbstractValidator<TransferOrderCommand>
{
    public TransferOrderValidator() => RuleFor(x => x.TableId).NotEmpty();
}

/// <summary>
/// <c>POST /orders/{id}/transfer</c> [orders.transfer]: moves a dine-in order to another usable table; the old table is
/// freed if no other active order uses it, the new one becomes occupied; <c>TableUpdated</c> for both; audited.
/// </summary>
public sealed class TransferOrderHandler(IAuditLogger audit, OrderWriter writer, TableOccupancy tables)
    : IHandler<TransferOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(TransferOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        if (order.Type != OrderType.DineIn)
        {
            return OrderErrors.NotDineIn;
        }

        if (order.TableId == request.TableId)
        {
            return await writer.ReadAsync(order.Id, cancellationToken);
        }

        var target = await tables.GetUsableTableAsync(request.TableId, cancellationToken);
        if (target.IsFailure)
        {
            return target.Error;
        }

        var fromTableId = order.TableId;
        order.TransferToTable(target.Value.Id);
        await tables.ReleaseIfFreeAsync(fromTableId, order.Id, cancellationToken);
        tables.Occupy(target.Value);
        audit.Log("order.transferred", nameof(Order), order.Id, new { fromTableId, toTableId = target.Value.Id });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
