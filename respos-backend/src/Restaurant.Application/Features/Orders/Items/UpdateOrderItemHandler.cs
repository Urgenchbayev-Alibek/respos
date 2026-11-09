using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Items;

public sealed record UpdateOrderItemCommand(decimal Quantity, string? Comment)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }

    [JsonIgnore]
    public Guid ItemId { get; init; }
}

public sealed class UpdateOrderItemValidator : AbstractValidator<UpdateOrderItemCommand>
{
    public UpdateOrderItemValidator()
    {
        RuleFor(x => x.Quantity).GreaterThan(0m).LessThanOrEqualTo(AddItemRequestValidator.MaxQuantity).PrecisionScale(18, 3, true);
        RuleFor(x => x.Comment).MaximumLength(AddItemRequestValidator.CommentMaxLength);
    }
}

/// <summary><c>PUT /orders/{id}/items/{itemId}</c>: only items in status <c>new</c> (else 409 <c>order.item_not_editable</c>).</summary>
public sealed class UpdateOrderItemHandler(OrderWriter writer) : IHandler<UpdateOrderItemCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(UpdateOrderItemCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        order.UpdateItem(request.ItemId, request.Quantity, comment, await writer.PricingAsync(cancellationToken));
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
