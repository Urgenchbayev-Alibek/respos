using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>Item-level operations of the order aggregate (edit, cancel, kitchen progress, serving).</summary>
public partial class Order
{
    /// <summary>Re-assigns the per-day number (used when a concurrent insert took the same number).</summary>
    public void Renumber(int number)
    {
        if (number <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(number));
        }

        Number = number;
    }

    /// <summary>Changes quantity/comment of a <c>new</c> item and recalculates totals.</summary>
    public void UpdateItem(Guid orderItemId, decimal quantity, string? comment, OrderPricingSettings settings)
    {
        EnsureNotClosed();
        EnsureNotSplit();
        var item = GetItem(orderItemId);
        item.SetQuantity(quantity);
        item.Comment = comment;
        RecalculateTotals(settings);
    }

    /// <summary>Cancels one item (reason required); the total may not drop below what is already paid.</summary>
    public OrderItem CancelItem(Guid orderItemId, string reason, OrderPricingSettings settings, Guid? changedBy, DateTime utcNow)
    {
        EnsureNotClosed();
        EnsureNotSplit();
        var item = GetItem(orderItemId);
        item.Cancel(reason);
        RecalculateTotals(settings);
        if (Total < PaidAmount)
        {
            throw new DomainException(OrderErrors.HasPayments);
        }

        SyncStatusFromItems(changedBy, utcNow);
        return item;
    }

    /// <summary>Kitchen started an item: <c>sent → preparing</c> (no-op when it is already preparing).</summary>
    public void StartItemPreparing(Guid orderItemId, Guid? changedBy, DateTime utcNow)
    {
        var item = GetItem(orderItemId);
        if (item.Status == OrderItemStatus.Preparing)
        {
            return;
        }

        item.StartPreparing();
        SyncStatusFromItems(changedBy, utcNow);
    }

    /// <summary>Recall from the kitchen: <c>ready → preparing</c>.</summary>
    public void RecallItem(Guid orderItemId, Guid? changedBy, DateTime utcNow)
    {
        var item = GetItem(orderItemId);
        if (item.Status != OrderItemStatus.Ready)
        {
            return;
        }

        item.StartPreparing();
        SyncStatusFromItems(changedBy, utcNow);
    }

    /// <summary>Waiter served an item: <c>ready → served</c>. Allowed on paid orders too (takeaway pays first).</summary>
    public void ServeItem(Guid orderItemId, Guid? changedBy, DateTime utcNow)
    {
        GetItem(orderItemId).MarkServed();
        SyncStatusFromItems(changedBy, utcNow);
    }

    /// <summary>Serves every <c>ready</c> item; returns the served items.</summary>
    public IReadOnlyList<OrderItem> ServeAllReady(Guid? changedBy, DateTime utcNow)
    {
        var ready = Items.Where(i => i.Status == OrderItemStatus.Ready).ToList();
        foreach (var item in ready)
        {
            item.MarkServed();
        }

        SyncStatusFromItems(changedBy, utcNow);
        return ready;
    }
}
