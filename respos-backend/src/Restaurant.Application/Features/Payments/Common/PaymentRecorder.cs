using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Common;

/// <summary>What to record: <see cref="Amount"/> goes to the order/bill, <see cref="TipAmount"/> is on top (not revenue).</summary>
public sealed record PaymentRecord(
    Guid? BillId,
    PaymentMethod Method,
    decimal Amount,
    decimal TipAmount,
    string Provider,
    string? ExternalReference,
    Guid CashShiftId,
    string IdempotencyKey);

/// <summary>
/// Applies a payment to the order aggregate (whole order or one bill → domain rules, may mark the order paid and raise
/// OrderPaidDomainEvent) and queues the payment row, audit and realtime. Shared by the cashier endpoint and provider callbacks.
/// </summary>
[ScopedService]
public sealed class PaymentRecorder(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit,
    IRealtimeNotifier realtime, OrderWriter orders)
{
    /// <summary>Tracked order of <paramref name="branchId"/> with its bills (null → 404).</summary>
    public Task<Order?> LoadOrderAsync(Guid orderId, Guid branchId, CancellationToken ct) =>
        db.Orders.Include(o => o.Bills).FirstOrDefaultAsync(o => o.Id == orderId && o.BranchId == branchId, ct);

    /// <summary>True when a pending, not yet expired provider payment exists for the order (or the given bill).</summary>
    public Task<bool> HasActiveIntentAsync(Guid orderId, Guid? billId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return db.PaymentIntents.AnyAsync(i => i.OrderId == orderId
            && (billId == null || i.BillId == null || i.BillId == billId)
            && i.Status == PaymentIntentStatus.Pending
            && (i.ExpiresAt > now || i.ProviderState == PaymentIntent.StateCreated), ct);
    }

    public Payment Record(Order order, PaymentRecord record)
    {
        if (record.BillId is { } billId)
        {
            order.RegisterBillPayment(billId, record.Amount, tenant.UserId, clock.UtcNow);
        }
        else
        {
            order.RegisterPayment(record.Amount, tenant.UserId, clock.UtcNow);
        }

        var payment = new Payment
        {
            OrganizationId = order.OrganizationId,
            BranchId = order.BranchId,
            OrderId = order.Id,
            BillId = record.BillId,
            CashShiftId = record.CashShiftId,
            Method = record.Method,
            Amount = record.Amount,
            TipAmount = Money.Round(record.TipAmount),
            Provider = record.Provider,
            ExternalReference = string.IsNullOrWhiteSpace(record.ExternalReference) ? null : record.ExternalReference.Trim(),
            IdempotencyKey = record.IdempotencyKey,
        };
        db.Payments.Add(payment);
        audit.Log(new AuditEntry("payment.registered", nameof(Payment), payment.Id.ToString(), new
        {
            orderId = order.Id, payment.BillId, payment.Method, payment.Amount, payment.TipAmount, payment.Provider,
            orderStatus = order.Status, order.PaidAmount, order.Total,
        })
        {
            OrganizationId = order.OrganizationId,
            BranchId = order.BranchId,
        });
        realtime.ToBranch(order.BranchId, RealtimeEvents.PaymentRegistered, new
        {
            orderId = order.Id, paymentId = payment.Id, amount = payment.Amount, branchId = order.BranchId, occurredAt = clock.UtcNow,
        });
        orders.NotifyOrderUpdated(order);
        return payment;
    }
}
