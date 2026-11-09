using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Items;

public sealed record AddOrderItemsCommand(IReadOnlyList<AddItemRequest> Items)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class AddOrderItemsValidator : AbstractValidator<AddOrderItemsCommand>
{
    public AddOrderItemsValidator()
    {
        RuleFor(x => x.Items).NotEmpty().Must(i => i is null || i.Count <= AddItemRequestValidator.MaxItemsPerRequest);
        RuleForEach(x => x.Items).SetValidator(new AddItemRequestValidator());
    }
}

/// <summary><c>POST /orders/{id}/items</c>: new items (status <c>new</c>) on an open order; totals and status recomputed.</summary>
public sealed class AddOrderItemsHandler(ITenantContext tenant, IClock clock, OrderWriter writer, OrderItemFactory itemFactory)
    : IHandler<AddOrderItemsCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(AddOrderItemsCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var items = await itemFactory.BuildAsync(request.Items, await writer.BranchLocalNowAsync(cancellationToken), cancellationToken);
        if (items.IsFailure)
        {
            return items.Error;
        }

        var pricing = await writer.PricingAsync(cancellationToken);
        foreach (var item in items.Value)
        {
            order.AddItem(item, pricing, userId, clock.UtcNow);
        }

        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
