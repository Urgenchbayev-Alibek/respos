using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.ApplyDiscount;

public sealed record ApplyDiscountCommand(DiscountType Type, decimal Value, string? Reason)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class ApplyDiscountValidator : AbstractValidator<ApplyDiscountCommand>
{
    public ApplyDiscountValidator()
    {
        RuleFor(x => x.Type).IsInEnum();
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.Value).LessThanOrEqualTo(100m).When(x => x.Type == DiscountType.Percent);
        RuleFor(x => x.Reason).NotEmpty().When(x => x.Type != DiscountType.None).MaximumLength(500);
    }
}

/// <summary><c>POST /orders/{id}/discount</c> [orders.discount.apply]: reason required; totals recalculated; audited.</summary>
public sealed class ApplyDiscountHandler(IAuditLogger audit, OrderWriter writer) : IHandler<ApplyDiscountCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(ApplyDiscountCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var before = new { order.DiscountType, order.DiscountValue, order.DiscountAmount, order.Total };
        order.ApplyDiscount(request.Type, request.Value, await writer.PricingAsync(cancellationToken));
        var after = new { order.DiscountType, order.DiscountValue, order.DiscountAmount, order.Total };
        audit.Log("order.discount_applied", nameof(Order), order.Id, new { before, after, reason = request.Reason?.Trim() });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
