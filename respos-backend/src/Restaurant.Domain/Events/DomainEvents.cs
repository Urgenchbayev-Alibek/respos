using Restaurant.Domain.Common;

namespace Restaurant.Domain.Events;

/// <summary>
/// Raised when an order becomes fully paid. Handled inside the same transaction
/// (inventory consumption, table release) before commit.
/// </summary>
public sealed record OrderPaidDomainEvent(Guid OrderId, Guid BranchId) : DomainEvent
{
    public Guid? TableId { get; init; }
}

/// <summary>Raised when items of an order are sent to the kitchen.</summary>
public sealed record OrderSubmittedDomainEvent(Guid OrderId, Guid BranchId) : DomainEvent;

/// <summary>Raised when an order item becomes ready (waiter toast).</summary>
public sealed record OrderItemReadyDomainEvent(Guid OrderId, Guid OrderItemId, Guid BranchId) : DomainEvent;

/// <summary>Raised when a stock balance drops to/below its minimum.</summary>
public sealed record StockLowDomainEvent(Guid IngredientId, Guid BranchId, decimal Quantity, decimal MinQuantity) : DomainEvent;

/// <summary>Raised when a purchase order (or part of it) is received.</summary>
public sealed record PurchaseReceivedDomainEvent(Guid PurchaseOrderId, Guid BranchId) : DomainEvent;
