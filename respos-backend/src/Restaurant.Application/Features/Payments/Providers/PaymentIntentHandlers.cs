using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Application.Features.Payments.RegisterPayment;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Providers;

/// <summary><c>POST /payments/intents</c>: pay the whole remaining amount of the order (or of one bill) online.</summary>
public sealed record CreatePaymentIntentCommand(Guid OrderId, Guid? BillId, string Provider, decimal TipAmount);

public sealed class CreatePaymentIntentValidator : AbstractValidator<CreatePaymentIntentCommand>
{
    public CreatePaymentIntentValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.BillId).NotEqual(Guid.Empty);
        RuleFor(x => x.Provider).NotEmpty().MaximumLength(32);
        RuleFor(x => x.TipAmount).GreaterThanOrEqualTo(0m).LessThan(RegisterPaymentValidator.MaxTip).PrecisionScale(18, 2, true);
    }
}

/// <summary>
/// Creates a pending intent with a payment link/QR. 404 order/bill/provider; 422 <c>cash_shift.not_open</c>,
/// <c>payment.provider_not_configured</c>, <c>payment.provider_not_enabled</c>, <c>payment.bill_required</c>, <c>payment.nothing_due</c>;
/// 409 <c>order.closed</c>, <c>order.bill_paid</c>, <c>payment.intent_pending</c>. No Payment row until the provider confirms.
/// </summary>
public sealed class CreatePaymentIntentHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    IAuditLogger audit,
    CashShiftReadService shifts,
    PaymentRecorder recorder,
    PaymentProviderCatalog catalog,
    IOptions<PaymentProvidersOptions> options)
    : IHandler<CreatePaymentIntentCommand, PaymentIntentDto>
{
    public async Task<Result<PaymentIntentDto>> HandleAsync(CreatePaymentIntentCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var order = await recorder.LoadOrderAsync(request.OrderId, branchId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var provider = catalog.Find(request.Provider);
        if (provider is null)
        {
            return PaymentIntentErrors.ProviderNotFound;
        }

        if (!PaymentProviderCatalog.IsUsable(provider))
        {
            return PaymentIntentErrors.ProviderNotConfigured;
        }

        if (!await catalog.IsEnabledAsync(provider.Code, cancellationToken))
        {
            return PaymentIntentErrors.ProviderNotEnabled;
        }

        var shift = await shifts.FindOpenAsync(tracked: false, cancellationToken);
        if (shift is null)
        {
            return CashShiftErrors.NotOpen;
        }

        var due = DueAmount(order, request.BillId);
        if (due.IsFailure)
        {
            return due.Error;
        }

        if (await recorder.HasActiveIntentAsync(order.Id, request.BillId, cancellationToken))
        {
            return PaymentIntentErrors.Pending;
        }

        var intent = new PaymentIntent
        {
            BranchId = branchId,
            OrderId = order.Id,
            BillId = request.BillId,
            CashShiftId = shift.Id,
            Provider = provider.Code,
            Amount = due.Value,
            TipAmount = Money.Round(request.TipAmount),
            ExpiresAt = clock.UtcNow.AddMinutes(Math.Max(1, options.Value.IntentLifetimeMinutes)),
        };
        var currency = await db.Organizations.AsNoTracking().Where(o => o.Id == order.OrganizationId).Select(o => o.Currency).FirstAsync(cancellationToken);
        intent.PaymentUrl = provider.CreatePaymentUrl(new PaymentLinkRequest(intent.Id, intent.TotalAmount, currency));
        db.PaymentIntents.Add(intent);
        audit.Log("payment.intent_created", nameof(PaymentIntent), intent.Id, new
        {
            orderId = order.Id, intent.BillId, intent.Provider, intent.Amount, intent.TipAmount,
        });
        await db.SaveChangesAsync(cancellationToken);
        return PaymentIntentDto.From(intent, clock.UtcNow);
    }

    private static Result<decimal> DueAmount(Order order, Guid? billId)
    {
        if (order.IsClosed)
        {
            return OrderErrors.OrderClosed;
        }

        if (order.IsSplit && billId is null)
        {
            return OrderBillErrors.BillRequired;
        }

        if (billId is { } id)
        {
            var bill = order.IsSplit ? order.Bills.FirstOrDefault(b => b.Id == id) : null;
            if (bill is null)
            {
                return OrderBillErrors.BillNotFound;
            }

            if (bill.Status == OrderBillStatus.Paid)
            {
                return OrderBillErrors.BillPaid;
            }

            return bill.RemainingAmount;
        }

        if (order.RemainingAmount <= 0)
        {
            return PaymentIntentErrors.NothingDue;
        }

        return order.RemainingAmount;
    }
}

public sealed record GetPaymentIntentQuery(Guid Id);

/// <summary><c>GET /payments/intents/{id}</c> — the cashier polls it (and refetches on PaymentRegistered).</summary>
public sealed class GetPaymentIntentHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock)
    : IHandler<GetPaymentIntentQuery, PaymentIntentDto>
{
    public async Task<Result<PaymentIntentDto>> HandleAsync(GetPaymentIntentQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var intent = await db.PaymentIntents.AsNoTracking().FirstOrDefaultAsync(i => i.Id == request.Id && i.BranchId == branchId, cancellationToken);
        return intent is null ? PaymentIntentErrors.NotFound : PaymentIntentDto.From(intent, clock.UtcNow);
    }
}

public sealed record ListPaymentIntentsQuery(Guid OrderId);

/// <summary><c>GET /payments/intents?orderId=</c> — newest first.</summary>
public sealed class ListPaymentIntentsHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock)
    : IHandler<ListPaymentIntentsQuery, IReadOnlyList<PaymentIntentDto>>
{
    public async Task<Result<IReadOnlyList<PaymentIntentDto>>> HandleAsync(ListPaymentIntentsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var intents = await db.PaymentIntents.AsNoTracking()
            .Where(i => i.OrderId == request.OrderId && i.BranchId == branchId)
            .OrderByDescending(i => i.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);
        return intents.Select(i => PaymentIntentDto.From(i, clock.UtcNow)).ToList();
    }
}

public sealed record CancelPaymentIntentCommand
{
    [JsonIgnore]
    public Guid Id { get; init; }
}

/// <summary><c>POST /payments/intents/{id}/cancel</c>: cashier cancels a pending intent (a later provider confirmation is refused).</summary>
public sealed class CancelPaymentIntentHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit)
    : IHandler<CancelPaymentIntentCommand, PaymentIntentDto>
{
    public const int CashierCancelReason = 3;

    public async Task<Result<PaymentIntentDto>> HandleAsync(CancelPaymentIntentCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var intent = await db.PaymentIntents.FirstOrDefaultAsync(i => i.Id == request.Id && i.BranchId == branchId, cancellationToken);
        if (intent is null)
        {
            return PaymentIntentErrors.NotFound;
        }

        intent.Cancel(CashierCancelReason, clock.UtcNow);
        audit.Log("payment.intent_cancelled", nameof(PaymentIntent), intent.Id, new { intent.Provider, intent.OrderId, by = "cashier" });
        await db.SaveChangesAsync(cancellationToken);
        return PaymentIntentDto.From(intent, clock.UtcNow);
    }
}
