using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Features.Payments.RefundPayment;

public sealed record RefundPaymentCommand(decimal Amount, string Reason)
{
    [JsonIgnore]
    public Guid PaymentId { get; init; }
}

public sealed class RefundPaymentValidator : AbstractValidator<RefundPaymentCommand>
{
    public RefundPaymentValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

/// <summary>
/// <c>POST /payments/{id}/refunds</c> [payments.refund] (Idempotency-Key): amount ≤ refundable (422
/// <c>payment.invalid_refund_amount</c>), recorded in the current open shift with the payment's method; order
/// paidAmount decreases (a paid order stays paid, MVP). Audited.
/// </summary>
public sealed class RefundPaymentHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IAuditLogger audit,
    PaymentGateway gateway,
    CashShiftReadService shifts,
    OrderWriter orders,
    UserNameLookup users)
    : IHandler<RefundPaymentCommand, RefundDto>
{
    public async Task<Result<RefundDto>> HandleAsync(RefundPaymentCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == request.PaymentId && p.BranchId == branchId, cancellationToken);
        if (payment is null)
        {
            return PaymentErrors.NotFound;
        }

        var shift = await shifts.FindOpenAsync(tracked: false, cancellationToken);
        if (shift is null)
        {
            return CashShiftErrors.NotOpen;
        }

        var order = await db.Orders.FirstAsync(o => o.Id == payment.OrderId, cancellationToken);
        var reason = request.Reason.Trim();
        var refund = payment.AddRefund(request.Amount, reason, shift.Id);
        db.Refunds.Add(refund);
        order.RegisterRefund(request.Amount);
        var result = await gateway.RefundAsync(payment, request.Amount, cancellationToken);
        if (!result.Succeeded)
        {
            return PaymentErrors.ProviderFailed;
        }

        audit.Log("payment.refunded", nameof(Payment), payment.Id, new
        {
            refundId = refund.Id, orderId = order.Id, refund.Amount, refund.Method, reason, payment.RefundedAmount,
        });
        orders.NotifyOrderUpdated(order);
        await db.SaveChangesAsync(cancellationToken);

        var names = await users.GetAsync([payment.CreatedBy, refund.CreatedBy], cancellationToken);
        return new RefundDto(refund.Id, payment.Id, order.Id, refund.CashShiftId, refund.Method, refund.Amount, refund.Reason,
            refund.CreatedAt, refund.CreatedBy is { } by ? names.GetValueOrDefault(by) : null, PaymentDto.From(payment, names, order.Number));
    }
}
