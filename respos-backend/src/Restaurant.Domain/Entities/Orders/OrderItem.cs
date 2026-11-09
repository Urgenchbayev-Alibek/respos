using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>Order line with name/price snapshots. Status: new → sent → preparing → ready → served; cancel before served.</summary>
public partial class OrderItem : Entity
{
    private static readonly Dictionary<OrderItemStatus, OrderItemStatus[]> Allowed = new()
    {
        [OrderItemStatus.New] = [OrderItemStatus.Sent, OrderItemStatus.Cancelled],
        [OrderItemStatus.Sent] = [OrderItemStatus.Preparing, OrderItemStatus.Ready, OrderItemStatus.Cancelled],
        [OrderItemStatus.Preparing] = [OrderItemStatus.Ready, OrderItemStatus.Cancelled],
        [OrderItemStatus.Ready] = [OrderItemStatus.Served, OrderItemStatus.Preparing],
        [OrderItemStatus.Served] = [],
        [OrderItemStatus.Cancelled] = [],
    };

    public Guid OrderId { get; set; }
    public Guid MenuItemId { get; set; }
    public Guid? VariantId { get; set; }
    public string NameSnapshot { get; set; } = string.Empty;
    public string? VariantNameSnapshot { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; private set; }
    public string? Comment { get; set; }
    public OrderItemStatus Status { get; private set; } = OrderItemStatus.New;
    public Guid? KitchenStationId { get; set; }
    public decimal LineTotal { get; private set; }
    public DateTime? SentAt { get; private set; }
    public DateTime? ReadyAt { get; private set; }
    public string? CancelReason { get; private set; }

    public List<OrderItemModifier> Modifiers { get; private set; } = [];

    public bool WasSent => Status is not (OrderItemStatus.New or OrderItemStatus.Cancelled);

    public static OrderItem Create(
        Guid menuItemId, string name, decimal unitPrice, decimal quantity,
        Guid? variantId = null, string? variantName = null, Guid? kitchenStationId = null, string? comment = null)
    {
        var item = new OrderItem
        {
            MenuItemId = menuItemId,
            NameSnapshot = name,
            UnitPrice = unitPrice,
            VariantId = variantId,
            VariantNameSnapshot = variantName,
            KitchenStationId = kitchenStationId,
            Comment = comment,
        };
        item.SetQuantity(quantity);
        return item;
    }

    public void AddModifier(Guid modifierOptionId, string name, decimal priceDelta)
    {
        Modifiers.Add(new OrderItemModifier
        {
            OrderItemId = Id,
            ModifierOptionId = modifierOptionId,
            NameSnapshot = name,
            PriceDelta = priceDelta,
        });
        RecalculateLineTotal();
    }

    public void SetQuantity(decimal quantity)
    {
        if (quantity <= 0)
        {
            throw new DomainException(OrderErrors.InvalidQuantity);
        }

        if (Status != OrderItemStatus.New)
        {
            throw new DomainException(OrderErrors.ItemNotEditable);
        }

        Quantity = quantity;
        RecalculateLineTotal();
    }

    /// <summary>lineTotal = (unitPrice + Σ modifier.priceDelta) × quantity, rounded to 2 decimals.</summary>
    public void RecalculateLineTotal() =>
        LineTotal = Money.Round((UnitPrice + Modifiers.Sum(m => m.PriceDelta)) * Quantity);

    public void MarkSent(DateTime utcNow)
    {
        TransitionTo(OrderItemStatus.Sent);
        SentAt = utcNow;
    }

    public void StartPreparing() => TransitionTo(OrderItemStatus.Preparing);

    public void MarkReady(DateTime utcNow)
    {
        TransitionTo(OrderItemStatus.Ready);
        ReadyAt = utcNow;
    }

    public void MarkServed() => TransitionTo(OrderItemStatus.Served);

    public void Cancel(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainException(OrderErrors.CancelReasonRequired);
        }

        TransitionTo(OrderItemStatus.Cancelled);
        CancelReason = reason;
    }

    /// <summary>Used when the whole order is cancelled (allowed from draft/submitted/in_progress only).</summary>
    internal void ForceCancel(string reason)
    {
        Status = OrderItemStatus.Cancelled;
        CancelReason = reason;
    }

    public static bool CanTransition(OrderItemStatus from, OrderItemStatus to) =>
        Allowed.TryGetValue(from, out var targets) && targets.Contains(to);

    private void TransitionTo(OrderItemStatus target)
    {
        if (!CanTransition(Status, target))
        {
            throw new DomainException(OrderErrors.InvalidItemTransition(Status, target));
        }

        Status = target;
    }
}

public class OrderItemModifier : Entity
{
    public Guid OrderItemId { get; set; }
    public Guid ModifierOptionId { get; set; }
    public string NameSnapshot { get; set; } = string.Empty;
    public decimal PriceDelta { get; set; }
}
