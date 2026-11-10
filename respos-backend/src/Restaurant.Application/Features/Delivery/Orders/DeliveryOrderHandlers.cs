using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Delivery.Orders;

/// <summary><c>Status</c> = comma list (<c>new,on_the_way</c>); empty = board default: open deliveries + those closed during the last 12 hours.</summary>
public sealed record ListDeliveriesQuery
{
    public string? Status { get; init; }
}

public sealed record GetDeliveryQuery(Guid OrderId);

public sealed record AssignCourierCommand(Guid? CourierId)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed record UpdateDeliveryDetailsCommand(
    string CustomerName,
    string CustomerPhone,
    string Address,
    string? Entrance,
    string? Floor,
    string? Apartment,
    string? Comment) : IDeliveryDetailsRequest
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class UpdateDeliveryDetailsValidator : AbstractValidator<UpdateDeliveryDetailsCommand>
{
    public UpdateDeliveryDetailsValidator() => Include(new DeliveryDetailsValidator());
}

/// <summary><c>GET /delivery/orders</c>: delivery board of the current branch, oldest first (max 300).</summary>
public sealed class ListDeliveriesHandler(IClock clock, DeliveryReadService deliveries)
    : IHandler<ListDeliveriesQuery, IReadOnlyList<DeliveryOrderDto>>
{
    public static readonly TimeSpan ClosedVisibleFor = TimeSpan.FromHours(12);

    public async Task<Result<IReadOnlyList<DeliveryOrderDto>>> HandleAsync(ListDeliveriesQuery request, CancellationToken cancellationToken)
    {
        var query = deliveries.BranchDeliveries();
        var statuses = SnakeCaseEnum.ParseList<DeliveryStatus>(request.Status);
        if (statuses.Count > 0)
        {
            query = query.Where(d => statuses.Contains(d.Status));
        }
        else
        {
            var since = clock.UtcNow - ClosedVisibleFor;
            query = query.Where(d =>
                (d.Status != DeliveryStatus.Delivered && d.Status != DeliveryStatus.Cancelled) || d.StatusChangedAt >= since);
        }

        var rows = await query.OrderBy(d => d.CreatedAt).Take(DeliveryReadService.MaxBoardSize).ToListAsync(cancellationToken);
        var result = await deliveries.MapAsync(rows, cancellationToken);
        return Result.Success(result);
    }
}

/// <summary><c>GET /delivery/orders/{orderId}</c>.</summary>
public sealed class GetDeliveryHandler(DeliveryReadService deliveries) : IHandler<GetDeliveryQuery, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> HandleAsync(GetDeliveryQuery request, CancellationToken cancellationToken)
    {
        var dto = await deliveries.GetAsync(request.OrderId, cancellationToken);
        return dto is null ? DeliveryErrors.NotFound : dto;
    }
}

/// <summary><c>POST /delivery/orders/{orderId}/courier</c> <c>{ courierId | null }</c> (active courier of the branch).</summary>
public sealed class AssignCourierHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit, DeliveryReadService deliveries)
    : IHandler<AssignCourierCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> HandleAsync(AssignCourierCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var delivery = await deliveries.LoadAsync(request.OrderId, cancellationToken);
        if (delivery is null)
        {
            return DeliveryErrors.NotFound;
        }

        if (request.CourierId is { } courierId)
        {
            var courier = await CourierRules.EnsureAssignableAsync(db, branchId, courierId, cancellationToken);
            if (courier.IsFailure)
            {
                return courier.Error;
            }
        }

        delivery.AssignCourier(request.CourierId);
        audit.Log(new AuditEntry("delivery.courier_assigned", "order", delivery.OrderId.ToString(), new { request.CourierId }) { BranchId = branchId });
        deliveries.NotifyUpdated(delivery);
        await db.SaveChangesAsync(cancellationToken);
        var dto = await deliveries.GetAsync(delivery.OrderId, cancellationToken);
        return dto is null ? DeliveryErrors.NotFound : dto;
    }
}

/// <summary><c>PUT /delivery/orders/{orderId}</c>: customer/address details (not after delivered/cancelled).</summary>
public sealed class UpdateDeliveryDetailsHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit, DeliveryReadService deliveries)
    : IHandler<UpdateDeliveryDetailsCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> HandleAsync(UpdateDeliveryDetailsCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var delivery = await deliveries.LoadAsync(request.OrderId, cancellationToken);
        if (delivery is null)
        {
            return DeliveryErrors.NotFound;
        }

        delivery.UpdateDetails(request.ToAddress());
        audit.Log(new AuditEntry("delivery.updated", "order", delivery.OrderId.ToString(),
            new { delivery.CustomerPhone, delivery.Address }) { BranchId = branchId });
        deliveries.NotifyUpdated(delivery);
        await db.SaveChangesAsync(cancellationToken);
        var dto = await deliveries.GetAsync(delivery.OrderId, cancellationToken);
        return dto is null ? DeliveryErrors.NotFound : dto;
    }
}
