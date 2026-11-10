using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Sub-check of a split order (child of the <see cref="Order"/> aggregate, no OrganizationId).
/// Σ bill amounts == order total at split time; the order is locked for item/discount changes while split.
/// </summary>
public class OrderBill : Entity
{
    public Guid OrderId { get; internal set; }
    public int Number { get; internal set; }
    public BillSplitMode Mode { get; internal set; }
    public decimal Amount { get; internal set; }
    public decimal PaidAmount { get; internal set; }
    public OrderBillStatus Status { get; internal set; } = OrderBillStatus.Open;

    /// <summary>Item allocations (only for <see cref="BillSplitMode.Items"/>).</summary>
    public List<OrderBillItem> Items { get; private set; } = [];

    public decimal RemainingAmount => Amount - PaidAmount;
}

/// <summary>
/// Quantity of an order item allocated to a bill. Order items are not split into rows (kitchen tickets keep
/// referencing the original item); <see cref="Amount"/> is the allocated share of the line total (display only).
/// </summary>
public class OrderBillItem : Entity
{
    public Guid BillId { get; internal set; }
    public Guid OrderItemId { get; internal set; }
    public decimal Quantity { get; internal set; }
    public decimal Amount { get; internal set; }
}

/// <summary>One requested allocation for <see cref="Order.SplitByItems"/>.</summary>
public sealed record BillItemAllocation(Guid OrderItemId, decimal Quantity);
