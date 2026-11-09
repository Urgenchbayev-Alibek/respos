using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.RegisterPayment;

public sealed record RegisterPaymentCommand(Guid OrderId, PaymentMethod Method, decimal Amount, string? ExternalReference)
{
    /// <summary>From the <c>Idempotency-Key</c> header (stored on the payment, unique per org).</summary>
    [JsonIgnore]
    public string IdempotencyKey { get; init; } = string.Empty;
}

public sealed class RegisterPaymentValidator : AbstractValidator<RegisterPaymentCommand>
{
    public RegisterPaymentValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Amount).GreaterThan(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.ExternalReference).MaximumLength(200);
    }
}

/// <summary>
/// <c>POST /payments</c> (Idempotency-Key): unknown/foreign order → 404 first; then requires an open shift (422 <c>cash_shift.not_open</c>); 0 &lt; amount ≤ remaining
/// (422 <c>payment.exceeds_due</c>); charged through the payment provider. Full payment → order <c>paid</c>
/// (OrderPaidDomainEvent: table release, inventory consumption — same transaction). Audited; realtime after commit.
/// </summary>
public sealed class RegisterPaymentHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    IAuditLogger audit,
    IRealtimeNotifier realtime,
    PaymentGateway gateway,
    CashShiftReadService shifts,
    OrderWriter orders,
    UserNameLookup users)
    : IHandler<RegisterPaymentCommand, PaymentDto>
{
    public async Task<Result<PaymentDto>> HandleAsync(RegisterPaymentCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == request.OrderId && o.BranchId == branchId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var shift = await shifts.FindOpenAsync(tracked: false, cancellationToken);
        if (shift is null)
        {
            return CashShiftErrors.NotOpen;
        }

        if (await db.Payments.AnyAsync(p => p.IdempotencyKey == request.IdempotencyKey, cancellationToken))
        {
            return PaymentErrors.Duplicate;
        }

        order.RegisterPayment(request.Amount, tenant.UserId, clock.UtcNow);
        var payment = new Payment
        {
            BranchId = branchId,
            OrderId = order.Id,
            CashShiftId = shift.Id,
            Method = request.Method,
            Amount = request.Amount,
            Provider = gateway.ProviderCode,
            ExternalReference = string.IsNullOrWhiteSpace(request.ExternalReference) ? null : request.ExternalReference.Trim(),
            IdempotencyKey = request.IdempotencyKey,
        };
        var charge = await gateway.ChargeAsync(payment, cancellationToken);
        if (!charge.Succeeded)
        {
            return PaymentErrors.ProviderFailed;
        }

        payment.ExternalReference = charge.ExternalReference ?? payment.ExternalReference;
        db.Payments.Add(payment);
        audit.Log("payment.registered", nameof(Payment), payment.Id, new
        {
            orderId = order.Id, payment.Method, payment.Amount, orderStatus = order.Status, order.PaidAmount, order.Total,
        });
        realtime.ToBranch(branchId, RealtimeEvents.PaymentRegistered, new
        {
            orderId = order.Id, paymentId = payment.Id, amount = payment.Amount, branchId, occurredAt = clock.UtcNow,
        });
        orders.NotifyOrderUpdated(order);
        await db.SaveChangesAsync(cancellationToken);

        return PaymentDto.From(payment, await users.GetAsync([payment.CreatedBy], cancellationToken), order.Number);
    }
}
