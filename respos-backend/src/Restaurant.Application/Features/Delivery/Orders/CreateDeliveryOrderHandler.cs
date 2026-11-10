using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Delivery.Orders;

public sealed record CreateDeliveryOrderCommand(
    string CustomerName,
    string CustomerPhone,
    string Address,
    string? Entrance,
    string? Floor,
    string? Apartment,
    string? Comment,
    Guid? CourierId,
    IReadOnlyList<AddItemRequest> Items) : IDeliveryDetailsRequest;

public sealed class CreateDeliveryOrderValidator : AbstractValidator<CreateDeliveryOrderCommand>
{
    public CreateDeliveryOrderValidator()
    {
        Include(new DeliveryDetailsValidator());
        RuleFor(x => x.Items).NotEmpty().WithErrorCode(DeliveryErrors.ItemsRequired.Code)
            .Must(i => i is null || i.Count <= AddItemRequestValidator.MaxItemsPerRequest);
        RuleForEach(x => x.Items).SetValidator(new AddItemRequestValidator());
    }
}

/// <summary>
/// <c>POST /delivery/orders</c>: order of type <c>delivery</c> (status draft, items not sent yet) + delivery details in
/// status <c>new</c>. The branch <c>deliveryFee</c> is snapshotted on the order and added to its total.
/// Items go to the kitchen when the delivery is accepted.
/// </summary>
public sealed class CreateDeliveryOrderHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    IAuditLogger audit,
    OrderWriter writer,
    OrderItemFactory itemFactory,
    DeliveryReadService deliveries) : IHandler<CreateDeliveryOrderCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> HandleAsync(CreateDeliveryOrderCommand request, CancellationToken cancellationToken)
    {
        var organizationId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var userId = tenant.RequireUserId();
        var now = clock.UtcNow;
        if (request.CourierId is { } courierId)
        {
            var courier = await CourierRules.EnsureAssignableAsync(db, branchId, courierId, cancellationToken);
            if (courier.IsFailure)
            {
                return courier.Error;
            }
        }

        var localNow = await writer.BranchLocalNowAsync(cancellationToken);
        var items = await itemFactory.BuildAsync(request.Items, localNow, cancellationToken);
        if (items.IsFailure)
        {
            return items.Error;
        }

        var businessDate = DateOnly.FromDateTime(localNow);
        var order = Order.Create(
            organizationId, branchId, OrderType.Delivery, null, userId, 0,
            await writer.NextNumberAsync(businessDate, cancellationToken), businessDate, null, now);
        var pricing = await writer.PricingAsync(cancellationToken);
        foreach (var item in items.Value)
        {
            order.AddItem(item, pricing, userId, now);
        }

        var fee = await db.BranchSettings.AsNoTracking()
            .Where(s => s.BranchId == branchId)
            .Select(s => s.DeliveryFee)
            .FirstOrDefaultAsync(cancellationToken);
        order.SetDeliveryFee(fee, pricing);
        db.Orders.Add(order);

        var delivery = OrderDelivery.Create(organizationId, branchId, order.Id, request.ToAddress(), now);
        delivery.AssignCourier(request.CourierId);
        db.OrderDeliveries.Add(delivery);

        audit.Log(new AuditEntry("delivery.created", "order", order.Id.ToString(),
            new { delivery.CustomerPhone, delivery.Address, order.DeliveryFee, order.Total }) { BranchId = branchId });
        writer.NotifyOrderUpdated(order);
        deliveries.NotifyUpdated(delivery);
        await writer.SaveNewOrderAsync(order, businessDate, cancellationToken);
        var dto = await deliveries.GetAsync(order.Id, cancellationToken);
        return dto is null ? DeliveryErrors.NotFound : dto;
    }
}

internal static class CourierRules
{
    /// <summary>Courier of the branch that is active (404 courier.not_found / 422 courier.inactive).</summary>
    public static async Task<Result<Courier>> EnsureAssignableAsync(IApplicationDbContext db, Guid branchId, Guid courierId, CancellationToken ct)
    {
        var courier = await db.Couriers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courierId && c.BranchId == branchId, ct);
        if (courier is null)
        {
            return DeliveryErrors.CourierNotFound;
        }

        if (!courier.IsActive)
        {
            return DeliveryErrors.CourierInactive;
        }

        return courier;
    }
}
