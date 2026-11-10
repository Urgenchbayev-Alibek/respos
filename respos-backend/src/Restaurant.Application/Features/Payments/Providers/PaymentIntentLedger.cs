using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Providers;

/// <summary>
/// Business side of provider callbacks (protocol, auth and signatures live in the provider adapters).
/// Callbacks have no JWT: an intent is found across tenants by its id / provider transaction id, then the request
/// enters that intent's tenant scope (<see cref="ITenantScopeOverride"/>) so filters, audit and domain events work normally.
/// </summary>
[ScopedService]
public sealed class PaymentIntentLedger(
    IApplicationDbContext db,
    ITenantScopeOverride scope,
    ITenantContext tenant,
    IClock clock,
    IAuditLogger audit,
    PaymentRecorder recorder)
{
    public DateTime UtcNow => clock.UtcNow;

    /// <summary>Tracked intent of <paramref name="provider"/> by id (enters its tenant scope) or null.</summary>
    public async Task<PaymentIntent?> FindAsync(Guid intentId, string provider, CancellationToken ct)
    {
        var intent = await db.PaymentIntents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == intentId && i.Provider == provider, ct);
        return Enter(intent);
    }

    /// <summary>Tracked intent by provider transaction id (enters its tenant scope) or null.</summary>
    public async Task<PaymentIntent?> FindByTransactionAsync(string provider, string transactionId, CancellationToken ct)
    {
        var intent = await db.PaymentIntents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Provider == provider && i.ProviderTransactionId == transactionId, ct);
        return Enter(intent);
    }

    /// <summary>Provider transactions with provider time in [from, to] (Payme GetStatement; one merchant per deployment).</summary>
    public async Task<IReadOnlyList<PaymentIntent>> StatementAsync(string provider, long fromTime, long toTime, CancellationToken ct) =>
        await db.PaymentIntents.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.Provider == provider && i.ProviderTime != null && i.ProviderTime >= fromTime && i.ProviderTime <= toTime)
            .OrderBy(i => i.ProviderTime)
            .Take(1000)
            .ToListAsync(ct);

    /// <summary>The order (bill) is open and can still take the intent amount.</summary>
    public async Task<bool> CanAcceptAsync(PaymentIntent intent, CancellationToken ct)
    {
        var order = await recorder.LoadOrderAsync(intent.OrderId, intent.BranchId, ct);
        return order is not null && CanAccept(order, intent);
    }

    /// <summary>Audits the provider action and commits the intent changes.</summary>
    public async Task SaveAsync(PaymentIntent intent, string action, CancellationToken ct)
    {
        Audit(intent, action);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Confirms the intent: records the Payment (method <c>other</c>, provider code, idempotency key <c>provider:transactionId</c>),
    /// applies it to the order/bill (may mark the order paid) and commits. False when the order can no longer take the amount.
    /// </summary>
    public async Task<bool> CompleteAsync(PaymentIntent intent, CancellationToken ct)
    {
        var order = await recorder.LoadOrderAsync(intent.OrderId, intent.BranchId, ct);
        if (order is null || !CanAccept(order, intent))
        {
            return false;
        }

        var openShiftId = await db.CashShifts
            .Where(s => s.BranchId == intent.BranchId && s.Status == CashShiftStatus.Open)
            .Select(s => (Guid?)s.Id)
            .FirstOrDefaultAsync(ct);
        var payment = recorder.Record(order, new PaymentRecord(
            intent.BillId, PaymentMethod.Other, intent.Amount, intent.TipAmount, intent.Provider, intent.ProviderTransactionId,
            openShiftId ?? intent.CashShiftId, $"{intent.Provider}:{intent.ProviderTransactionId ?? intent.Id.ToString()}"));
        intent.MarkCompleted(payment.Id, clock.UtcNow);
        await SaveAsync(intent, "payment.intent_completed", ct);
        return true;
    }

    private static bool CanAccept(Order order, PaymentIntent intent)
    {
        if (order.IsClosed)
        {
            return false;
        }

        if (intent.BillId is { } billId)
        {
            var bill = order.Bills.FirstOrDefault(b => b.Id == billId);
            return bill is not null && bill.Status == OrderBillStatus.Open && intent.Amount <= bill.RemainingAmount;
        }

        return !order.IsSplit && intent.Amount <= order.RemainingAmount;
    }

    private void Audit(PaymentIntent intent, string action) =>
        audit.Log(new AuditEntry(action, nameof(PaymentIntent), intent.Id.ToString(), new
        {
            intent.Provider, intent.ProviderTransactionId, intent.ProviderState, intent.Status, intent.OrderId, intent.Amount, intent.TipAmount,
        })
        {
            OrganizationId = intent.OrganizationId,
            BranchId = intent.BranchId,
        });

    private PaymentIntent? Enter(PaymentIntent? intent)
    {
        if (intent is not null && tenant.OrganizationId is null)
        {
            scope.Enter(intent.OrganizationId, intent.BranchId);
        }

        return intent is not null && tenant.OrganizationId == intent.OrganizationId ? intent : null;
    }
}
