using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Customers.OrderGuest;

public sealed record GetOrderLoyaltyQuery(Guid OrderId);

public sealed record RedeemPointsCommand(decimal Points)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed record CancelRedemptionCommand(Guid OrderId);

public sealed class RedeemPointsValidator : AbstractValidator<RedeemPointsCommand>
{
    public RedeemPointsValidator() =>
        RuleFor(x => x.Points).GreaterThan(0m).Must(p => p == Math.Floor(p)).WithMessage("Points must be a whole number.");
}

/// <summary><c>GET /orders/{id}/loyalty</c>: balance, max redeemable now, redeemed, expected earn.</summary>
public sealed class GetOrderLoyaltyHandler(ITenantContext tenant, OrderWriter writer, LoyaltyLedger ledger, CustomerReadService customers)
    : IHandler<GetOrderLoyaltyQuery, OrderLoyaltyDto>
{
    public async Task<Result<OrderLoyaltyDto>> HandleAsync(GetOrderLoyaltyQuery request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var settings = await ledger.GetSettingsAsync(tenant.RequireOrganizationId(), cancellationToken);
        var points = 0m;
        if (order.CustomerId is { } customerId)
        {
            var summaries = await customers.GetSummariesAsync([customerId], cancellationToken);
            points = summaries.TryGetValue(customerId, out var summary) ? summary.Points : 0m;
        }

        var canRedeem = order.CustomerId is not null && !order.IsClosed && !order.IsSplit && order.LoyaltyDiscountAmount == 0
            && settings.Qualifies(order.Subtotal);
        var maxRedeemable = canRedeem ? RedeemRules.MaxFor(order, settings, points) : 0m;
        var expectedEarn = order.CustomerId is not null && settings.Qualifies(order.Subtotal) ? settings.PointsFor(order.Total) : 0m;
        return new OrderLoyaltyDto(settings.IsEnabled, order.CustomerId, points, maxRedeemable, order.LoyaltyDiscountAmount, expectedEarn,
            settings.MinOrderAmount, settings.MaxRedeemPercent);
    }
}

internal static class RedeemRules
{
    /// <summary>min(balance, floor(max% × (subtotal − manual discount)), still unpaid part of the bill).</summary>
    public static decimal MaxFor(Order order, LoyaltySettings settings, decimal balance) =>
        Math.Max(0m, Math.Min(Math.Min(Math.Floor(balance), settings.MaxRedeemFor(order.LoyaltyBase)), Math.Floor(order.RemainingAmount)));
}

/// <summary>
/// <c>POST /orders/{id}/loyalty/redeem</c> [loyalty.redeem]: pays part of the bill with points (1 point = 1 currency unit)
/// as a loyalty discount. Rules: program enabled, customer attached, subtotal ≥ min order, points ≤ balance and
/// ≤ max % of (subtotal − manual discount). One active redemption per order; not on a split order (merge first). Audited.
/// </summary>
public sealed class RedeemPointsHandler(
    ITenantContext tenant, IClock clock, IAuditLogger audit, OrderWriter writer, LoyaltyLedger ledger)
    : IHandler<RedeemPointsCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(RedeemPointsCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var settings = await ledger.GetSettingsAsync(tenant.RequireOrganizationId(), cancellationToken);
        if (!settings.IsEnabled)
        {
            return LoyaltyErrors.Disabled;
        }

        if (order.IsClosed)
        {
            return OrderErrors.OrderClosed;
        }

        if (order.IsSplit)
        {
            return OrderBillErrors.SplitActive;
        }

        if (order.CustomerId is not { } customerId)
        {
            return LoyaltyErrors.NoCustomer;
        }

        if (order.LoyaltyDiscountAmount > 0)
        {
            return LoyaltyErrors.AlreadyRedeemed;
        }

        if (!settings.Qualifies(order.Subtotal))
        {
            return LoyaltyErrors.BelowMinOrder;
        }

        var now = clock.UtcNow;
        var account = await ledger.GetAccountAsync(order.OrganizationId, customerId, now, cancellationToken);
        if (request.Points > account.Balance)
        {
            return LoyaltyErrors.InsufficientPoints;
        }

        if (request.Points > RedeemRules.MaxFor(order, settings, account.Balance))
        {
            return LoyaltyErrors.ExceedsLimit;
        }

        account.Redeem(order.Id, request.Points, now, tenant.UserId);
        order.ApplyLoyaltyDiscount(request.Points, await writer.PricingAsync(cancellationToken));
        audit.Log("loyalty.redeemed", nameof(Order), order.Id, new { customerId, points = request.Points, order.Total });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}

/// <summary><c>DELETE /orders/{id}/loyalty/redeem</c> [loyalty.redeem]: removes the points discount and returns the points.</summary>
public sealed class CancelRedemptionHandler(
    ITenantContext tenant, IClock clock, IAuditLogger audit, OrderWriter writer, LoyaltyLedger ledger)
    : IHandler<CancelRedemptionCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(CancelRedemptionCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        if (order.CustomerId is not { } customerId)
        {
            return LoyaltyErrors.NothingRedeemed;
        }

        if (order.IsSplit)
        {
            return OrderBillErrors.SplitActive;
        }

        order.ClearLoyaltyDiscount(await writer.PricingAsync(cancellationToken));
        var now = clock.UtcNow;
        var net = Math.Floor(LoyaltyLedger.NetRedeemed(await ledger.OrderEntriesAsync(order.Id, cancellationToken)));
        var settings = await ledger.GetSettingsAsync(order.OrganizationId, cancellationToken);
        var account = await ledger.GetAccountAsync(order.OrganizationId, customerId, now, cancellationToken);
        account.ReturnRedeemed(order.Id, net, LoyaltyReason.RedemptionCancelled, settings.ExpiryFrom(now), now, tenant.UserId);
        audit.Log("loyalty.redemption_cancelled", nameof(Order), order.Id, new { customerId, points = net });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
