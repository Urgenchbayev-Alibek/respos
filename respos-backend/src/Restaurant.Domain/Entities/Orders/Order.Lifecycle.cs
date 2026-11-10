using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

public partial class Order
{
    public void AddItem(OrderItem item, OrderPricingSettings settings, Guid? changedBy, DateTime utcNow)
    {
        EnsureNotClosed();
        EnsureNotSplit();
        item.OrderId = Id;
        Items.Add(item);
        RecalculateTotals(settings);
        SyncStatusFromItems(changedBy, utcNow);
    }

    /// <summary>
    /// Marks <c>new</c> items as sent (all of them when <paramref name="itemIds"/> is null), re-derives the status
    /// and raises <see cref="OrderSubmittedDomainEvent"/>. Returns the items that were sent.
    /// </summary>
    public IReadOnlyList<OrderItem> SendItems(IReadOnlyCollection<Guid>? itemIds, Guid? changedBy, DateTime utcNow)
    {
        EnsureNotClosed();
        var toSend = Items
            .Where(i => i.Status == OrderItemStatus.New && (itemIds is null || itemIds.Contains(i.Id)))
            .ToList();
        if (toSend.Count == 0)
        {
            throw new DomainException(OrderErrors.NothingToSend);
        }

        foreach (var item in toSend)
        {
            item.MarkSent(utcNow);
        }

        SyncStatusFromItems(changedBy, utcNow);
        Raise(new OrderSubmittedDomainEvent(Id, BranchId));
        return toSend;
    }

    /// <summary>Marks an item ready, re-derives the status and raises <see cref="OrderItemReadyDomainEvent"/>.</summary>
    public void MarkItemReady(Guid orderItemId, Guid? changedBy, DateTime utcNow)
    {
        var item = GetItem(orderItemId);
        item.MarkReady(utcNow);
        SyncStatusFromItems(changedBy, utcNow);
        Raise(new OrderItemReadyDomainEvent(Id, item.Id, BranchId));
    }

    public OrderItem GetItem(Guid orderItemId) =>
        Items.FirstOrDefault(i => i.Id == orderItemId) ?? throw new DomainException(OrderErrors.ItemNotFound);

    /// <summary>Re-derives the status from items after any item change (no-op for terminal orders).</summary>
    public void SyncStatusFromItems(Guid? changedBy, DateTime utcNow)
    {
        if (IsClosed)
        {
            return;
        }

        var target = OrderStatusTransitions.DeriveFromItems(Items.Select(i => i.Status));
        if (target != Status)
        {
            TransitionTo(target, changedBy, utcNow);
        }
    }

    /// <summary>Cancels a non-terminal order with nothing paid (refund first otherwise). Reason required.</summary>
    public void Cancel(string reason, Guid? changedBy, DateTime utcNow)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainException(OrderErrors.CancelReasonRequired);
        }

        if (!IsClosed && PaidAmount != 0)
        {
            throw new DomainException(OrderErrors.HasPayments);
        }

        TransitionTo(OrderStatus.Cancelled, changedBy, utcNow, reason);
        CancelReason = reason;
        ClosedAt = utcNow;
        foreach (var item in Items.Where(i => i.Status != OrderItemStatus.Cancelled))
        {
            item.ForceCancel(reason);
        }
        Raise(new OrderCancelledDomainEvent(Id, BranchId));
    }

    /// <summary>Registers a payment (any non-terminal status); marks the order paid when fully covered.</summary>
    public void RegisterPayment(decimal amount, Guid? changedBy, DateTime utcNow)
    {
        if (amount <= 0)
        {
            throw new DomainException(OrderErrors.InvalidPaymentAmount);
        }

        if (IsClosed)
        {
            throw new DomainException(OrderErrors.NotPayable(Status));
        }

        if (IsSplit)
        {
            throw new DomainException(OrderBillErrors.BillRequired);
        }

        ApplyPayment(amount, changedBy, utcNow);
    }

    private void ApplyPayment(decimal amount, Guid? changedBy, DateTime utcNow)
    {
        if (amount > RemainingAmount)
        {
            throw new DomainException(OrderErrors.PaymentExceedsDue);
        }

        PaidAmount += amount;
        if (PaidAmount == Total && Total > 0)
        {
            MarkPaid(changedBy, utcNow);
        }
    }

    /// <summary>paidAmount −= refund. A paid order stays paid (MVP).</summary>
    public void RegisterRefund(decimal amount)
    {
        if (amount <= 0 || amount > PaidAmount)
        {
            throw new DomainException(OrderErrors.InvalidRefundAmount);
        }

        PaidAmount -= amount;
        Raise(new OrderRefundedDomainEvent(Id, BranchId, amount));
    }

    public void MarkPaid(Guid? changedBy, DateTime utcNow)
    {
        TransitionTo(OrderStatus.Paid, changedBy, utcNow);
        ClosedAt = utcNow;
        Raise(new OrderPaidDomainEvent(Id, BranchId) { TableId = TableId });
    }

    private void TransitionTo(OrderStatus target, Guid? changedBy, DateTime utcNow, string? reason = null)
    {
        if (!OrderStatusTransitions.CanTransition(Status, target))
        {
            throw new DomainException(OrderErrors.InvalidTransition(Status, target));
        }

        History.Add(new OrderStatusHistory
        {
            OrderId = Id,
            FromStatus = Status,
            ToStatus = target,
            ChangedBy = changedBy,
            ChangedAt = utcNow,
            Reason = reason,
        });
        Status = target;
    }

    private void EnsureNotClosed()
    {
        if (IsClosed)
        {
            throw new DomainException(OrderErrors.OrderClosed);
        }
    }
}
