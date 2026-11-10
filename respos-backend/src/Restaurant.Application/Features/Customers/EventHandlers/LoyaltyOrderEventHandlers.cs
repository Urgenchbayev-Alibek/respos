using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;

namespace Restaurant.Application.Features.Customers.EventHandlers;

/// <summary>Loads the order of a domain event (tracked; DB first, then pending in this unit of work).</summary>
internal static class LoyaltyOrders
{
    public static async Task<Order?> FindAsync(IApplicationDbContext db, Guid orderId, CancellationToken ct) =>
        db.Orders.Local.FirstOrDefault(o => o.Id == orderId)
        ?? await db.Orders.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orderId, ct);
}

/// <summary>
/// On full payment (same unit of work): gives back points that were redeemed but not applied (discount clamped
/// after item cancellations), then earns <c>floor(total × earn%)</c>. Idempotent: one <c>earn</c> entry per order
/// (checked here + unique index on (order_id, type)).
/// </summary>
public sealed class EarnPointsOnOrderPaidHandler(IApplicationDbContext db, LoyaltyLedger ledger, IClock clock, IAuditLogger audit)
    : IDomainEventHandler<OrderPaidDomainEvent>
{
    public async Task HandleAsync(OrderPaidDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await LoyaltyOrders.FindAsync(db, domainEvent.OrderId, cancellationToken);
        if (order?.CustomerId is not { } customerId)
        {
            return;
        }

        var entries = await ledger.OrderEntriesAsync(order.Id, cancellationToken);
        if (entries.Any(t => t.Type == LoyaltyTransactionType.Earn || t.Reason == LoyaltyReason.Reconcile))
        {
            return;
        }

        var now = clock.UtcNow;
        var settings = await ledger.GetSettingsAsync(order.OrganizationId, cancellationToken);
        var unused = Math.Floor(LoyaltyLedger.NetRedeemed(entries) - order.LoyaltyDiscountAmount);
        var points = settings.Qualifies(order.Subtotal) ? settings.PointsFor(order.Total) : 0m;
        if (unused <= 0 && points <= 0)
        {
            return;
        }

        var account = await ledger.GetAccountAsync(order.OrganizationId, customerId, now, cancellationToken);
        account.ReturnRedeemed(order.Id, unused, LoyaltyReason.Reconcile, settings.ExpiryFrom(now), now, null);
        if (points > 0)
        {
            account.Earn(order.Id, points, settings.ExpiryFrom(now), now, null);
            audit.Log(new AuditEntry("loyalty.earned", nameof(LoyaltyAccount), account.Id.ToString(),
                new { orderId = order.Id, customerId, points })
            {
                OrganizationId = order.OrganizationId,
                BranchId = order.BranchId,
            });
        }
    }
}

/// <summary>
/// Refund on a paid order with a customer: takes back earned points and gives back redeemed points in proportion
/// to the refunded share of the total. Cumulative targets (<c>floor(x × refunded / total)</c> minus what was already
/// reversed) keep it idempotent and drift-free across partial refunds.
/// </summary>
public sealed class ReversePointsOnOrderRefundedHandler(IApplicationDbContext db, LoyaltyLedger ledger, IClock clock, IAuditLogger audit)
    : IDomainEventHandler<OrderRefundedDomainEvent>
{
    public async Task HandleAsync(OrderRefundedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await LoyaltyOrders.FindAsync(db, domainEvent.OrderId, cancellationToken);
        if (order is not { Status: OrderStatus.Paid, CustomerId: { } customerId } || order.Total <= 0)
        {
            return;
        }

        var ratio = Math.Clamp((order.Total - order.PaidAmount) / order.Total, 0m, 1m);
        var entries = (await ledger.OrderEntriesAsync(order.Id, cancellationToken))
            .Where(t => t.Type is LoyaltyTransactionType.Earn || t.Reason == LoyaltyReason.Refund)
            .ToList();
        var earned = entries.Where(t => t.Type == LoyaltyTransactionType.Earn).Sum(t => t.Points);
        var earnReversed = -entries.Where(t => t.Reason == LoyaltyReason.Refund && t.Points < 0).Sum(t => t.Points);
        var returned = entries.Where(t => t.Reason == LoyaltyReason.Refund && t.Points > 0).Sum(t => t.Points);
        var takeBack = Math.Floor(earned * ratio) - earnReversed;
        var giveBack = Math.Floor(order.LoyaltyDiscountAmount * ratio) - returned;
        if (takeBack <= 0 && giveBack <= 0)
        {
            return;
        }

        var now = clock.UtcNow;
        var settings = await ledger.GetSettingsAsync(order.OrganizationId, cancellationToken);
        var account = await ledger.GetAccountAsync(order.OrganizationId, customerId, now, cancellationToken);
        var reversed = takeBack > 0 ? account.ReverseEarned(order.Id, takeBack, now, null) : null;
        var returnedNow = account.ReturnRedeemed(order.Id, giveBack, LoyaltyReason.Refund, settings.ExpiryFrom(now), now, null);
        audit.Log(new AuditEntry("loyalty.reversed", nameof(LoyaltyAccount), account.Id.ToString(),
            new { orderId = order.Id, customerId, earnedTakenBack = -(reversed?.Points ?? 0m), redeemedReturned = returnedNow?.Points ?? 0m })
        {
            OrganizationId = order.OrganizationId,
            BranchId = order.BranchId,
        });
    }
}

/// <summary>Order cancelled: every point still spent on it goes back to the customer.</summary>
public sealed class ReturnPointsOnOrderCancelledHandler(IApplicationDbContext db, LoyaltyLedger ledger, IClock clock)
    : IDomainEventHandler<OrderCancelledDomainEvent>
{
    public async Task HandleAsync(OrderCancelledDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await LoyaltyOrders.FindAsync(db, domainEvent.OrderId, cancellationToken);
        if (order?.CustomerId is not { } customerId)
        {
            return;
        }

        var net = Math.Floor(LoyaltyLedger.NetRedeemed(await ledger.OrderEntriesAsync(order.Id, cancellationToken)));
        if (net <= 0)
        {
            return;
        }

        var now = clock.UtcNow;
        var settings = await ledger.GetSettingsAsync(order.OrganizationId, cancellationToken);
        var account = await ledger.GetAccountAsync(order.OrganizationId, customerId, now, cancellationToken);
        account.ReturnRedeemed(order.Id, net, LoyaltyReason.OrderCancelled, settings.ExpiryFrom(now), now, null);
    }
}
