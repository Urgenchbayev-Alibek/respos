using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Customers.OrderGuest;

public sealed record AttachCustomerCommand(Guid CustomerId)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed record DetachCustomerCommand(Guid OrderId);

public sealed class AttachCustomerValidator : AbstractValidator<AttachCustomerCommand>
{
    public AttachCustomerValidator() => RuleFor(x => x.CustomerId).NotEmpty();
}

/// <summary>
/// <c>POST /orders/{id}/customer</c>: links a guest of the same org to an open order of the current branch
/// (other tenant's customer → 404). Changing the guest while points are redeemed → 409 <c>loyalty.redemption_active</c>.
/// </summary>
public sealed class AttachCustomerHandler(IApplicationDbContext db, IAuditLogger audit, OrderWriter writer)
    : IHandler<AttachCustomerCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(AttachCustomerCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
        {
            return CustomerErrors.NotFound;
        }

        var previous = order.CustomerId;
        order.AttachCustomer(request.CustomerId);
        audit.Log("order.customer_attached", nameof(Order), order.Id, new { customerId = request.CustomerId, previous });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}

/// <summary><c>DELETE /orders/{id}/customer</c>: unlinks the guest (no-op when none).</summary>
public sealed class DetachCustomerHandler(IAuditLogger audit, OrderWriter writer) : IHandler<DetachCustomerCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(DetachCustomerCommand request, CancellationToken cancellationToken)
    {
        var order = await writer.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        if (order.CustomerId is not { } previous)
        {
            return await writer.ReadAsync(order.Id, cancellationToken);
        }

        order.DetachCustomer();
        audit.Log("order.customer_detached", nameof(Order), order.Id, new { previous });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
