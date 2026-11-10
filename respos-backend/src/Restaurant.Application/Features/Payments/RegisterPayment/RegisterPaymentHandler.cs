using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
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
    /// <summary>F2: required when the order is split (bill to pay); must be null otherwise.</summary>
    public Guid? BillId { get; init; }

    /// <summary>F2: optional tip on top of <see cref="Amount"/> (not revenue, credited to the order's waiter).</summary>
    public decimal TipAmount { get; init; }

    /// <summary>From the <c>Idempotency-Key</c> header (stored on the payment, unique per org).</summary>
    [JsonIgnore]
    public string IdempotencyKey { get; init; } = string.Empty;
}

public sealed class RegisterPaymentValidator : AbstractValidator<RegisterPaymentCommand>
{
    public const decimal MaxTip = 1_000_000_000m;

    public RegisterPaymentValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Amount).GreaterThan(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.TipAmount).GreaterThanOrEqualTo(0m).LessThan(MaxTip).PrecisionScale(18, 2, true);
        RuleFor(x => x.BillId).NotEqual(Guid.Empty);
        RuleFor(x => x.ExternalReference).MaximumLength(200);
    }
}

/// <summary>
/// <c>POST /payments</c> (Idempotency-Key): unknown/foreign order → 404 first; then requires an open shift (422 <c>cash_shift.not_open</c>); 0 &lt; amount ≤ remaining
/// (422 <c>payment.exceeds_due</c>; split orders: ≤ bill remaining, <c>billId</c> required → 422 <c>payment.bill_required</c>);
/// 409 <c>payment.intent_pending</c> while an online payment is pending; charged through the manual provider. Full payment → order <c>paid</c>
/// (OrderPaidDomainEvent: table release, inventory consumption — same transaction). Audited; realtime after commit.
/// </summary>
public sealed class RegisterPaymentHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    PaymentGateway gateway,
    CashShiftReadService shifts,
    PaymentRecorder recorder,
    UserNameLookup users)
    : IHandler<RegisterPaymentCommand, PaymentDto>
{
    public async Task<Result<PaymentDto>> HandleAsync(RegisterPaymentCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var order = await recorder.LoadOrderAsync(request.OrderId, branchId, cancellationToken);
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

        if (await recorder.HasActiveIntentAsync(order.Id, request.BillId, cancellationToken))
        {
            return PaymentIntentErrors.Pending;
        }

        var payment = recorder.Record(order, new PaymentRecord(
            request.BillId, request.Method, request.Amount, request.TipAmount, gateway.ProviderCode,
            request.ExternalReference, shift.Id, request.IdempotencyKey));
        var charge = await gateway.ChargeAsync(payment, cancellationToken);
        if (!charge.Succeeded)
        {
            return PaymentErrors.ProviderFailed;
        }

        payment.ExternalReference = charge.ExternalReference ?? payment.ExternalReference;
        await db.SaveChangesAsync(cancellationToken);

        return PaymentDto.From(payment, await users.GetAsync([payment.CreatedBy], cancellationToken), order.Number);
    }
}
