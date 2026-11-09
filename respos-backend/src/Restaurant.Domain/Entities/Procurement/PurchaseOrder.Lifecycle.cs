using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Procurement;

/// <summary>
/// Status flow: draft → submitted → partially_received → received; draft|submitted → cancelled.
/// Only drafts are editable. Receiving a line never exceeds its ordered quantity.
/// </summary>
public partial class PurchaseOrder
{
    public bool IsFullyReceived => Items.Count > 0 && Items.All(i => i.ReceivedQuantity >= i.Quantity);

    public void EnsureEditable()
    {
        if (Status != PurchaseOrderStatus.Draft)
        {
            throw new DomainException(ProcurementErrors.NotEditable);
        }
    }

    public void ReplaceItems(IEnumerable<PurchaseOrderItem> items)
    {
        EnsureEditable();
        Items.Clear();
        foreach (var item in items)
        {
            item.PurchaseOrderId = Id;
            Items.Add(item);
        }

        RecalculateTotal();
    }

    public void RecalculateTotal() => Total = Money.Round(Items.Sum(i => i.LineTotal));

    public void Submit() => TransitionTo(PurchaseOrderStatus.Submitted, PurchaseOrderStatus.Draft);

    public void Cancel() => TransitionTo(PurchaseOrderStatus.Cancelled, PurchaseOrderStatus.Draft, PurchaseOrderStatus.Submitted);

    public void EnsureReceivable()
    {
        if (Status is not (PurchaseOrderStatus.Submitted or PurchaseOrderStatus.PartiallyReceived))
        {
            throw new DomainException(ProcurementErrors.InvalidTransition(Status, PurchaseOrderStatus.Received));
        }
    }

    /// <summary>Adds <paramref name="quantity"/> (line unit) to a line's received quantity.</summary>
    public PurchaseOrderItem ReceiveLine(Guid itemId, decimal quantity)
    {
        EnsureReceivable();
        if (quantity <= 0)
        {
            throw new DomainException(ProcurementErrors.InvalidReceiveQuantity);
        }

        var item = Items.FirstOrDefault(i => i.Id == itemId) ?? throw new DomainException(ProcurementErrors.ItemNotFound);
        if (item.ReceivedQuantity + quantity > item.Quantity)
        {
            throw new DomainException(ProcurementErrors.ReceiveExceedsRemaining);
        }

        item.ReceivedQuantity += quantity;
        return item;
    }

    /// <summary>Sets partially_received / received after lines were received and raises the domain event.</summary>
    public void CompleteReceipt()
    {
        EnsureReceivable();
        Status = IsFullyReceived ? PurchaseOrderStatus.Received : PurchaseOrderStatus.PartiallyReceived;
        Raise(new PurchaseReceivedDomainEvent(Id, BranchId));
    }

    private void TransitionTo(PurchaseOrderStatus target, params PurchaseOrderStatus[] allowedFrom)
    {
        if (!allowedFrom.Contains(Status))
        {
            throw new DomainException(ProcurementErrors.InvalidTransition(Status, target));
        }

        Status = target;
    }
}
