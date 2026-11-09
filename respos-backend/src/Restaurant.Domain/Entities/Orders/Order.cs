using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Order aggregate root. Status changes only through methods in Order.Lifecycle.cs;
/// money is calculated in Order.Pricing.cs (CONVENTIONS.md "Money calculation").
/// </summary>
public partial class Order : AuditableEntity, IBranchScoped
{
    private Order()
    {
    }

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }

    /// <summary>Sequential per branch per <see cref="BusinessDate"/>; displayed as #0042.</summary>
    public int Number { get; private set; }

    /// <summary>Local (branch timezone) date the order number sequence belongs to.</summary>
    public DateOnly BusinessDate { get; private set; }

    public OrderType Type { get; private set; }
    public Guid? TableId { get; private set; }
    public Guid WaiterId { get; private set; }
    public int GuestCount { get; set; }
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;

    public decimal Subtotal { get; private set; }
    public DiscountType DiscountType { get; private set; } = DiscountType.None;
    public decimal DiscountValue { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal ServiceChargeAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }
    public decimal PaidAmount { get; private set; }

    public string? Comment { get; set; }
    public string? CancelReason { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c>.</summary>
    public uint RowVersion { get; private set; }

    public List<OrderItem> Items { get; private set; } = [];
    public List<OrderStatusHistory> History { get; private set; } = [];

    public decimal RemainingAmount => Total - PaidAmount;

    public bool IsClosed => Status is OrderStatus.Paid or OrderStatus.Cancelled;

    public static Order Create(
        Guid organizationId,
        Guid branchId,
        OrderType type,
        Guid? tableId,
        Guid waiterId,
        int guestCount,
        int number,
        DateOnly businessDate,
        string? comment,
        DateTime utcNow)
    {
        if (type == OrderType.DineIn && tableId is null)
        {
            throw new Exceptions.DomainException(OrderErrors.TableRequired);
        }

        return new Order
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            Type = type,
            TableId = tableId,
            WaiterId = waiterId,
            GuestCount = guestCount,
            Number = number,
            BusinessDate = businessDate,
            Comment = comment,
            OpenedAt = utcNow,
        };
    }

    public void TransferToTable(Guid tableId)
    {
        EnsureNotClosed();
        TableId = tableId;
    }
}

public class OrderStatusHistory : Entity
{
    public Guid OrderId { get; set; }
    public OrderStatus? FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    public Guid? ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? Reason { get; set; }
}

/// <summary>Branch pricing settings snapshot used by <see cref="Order.RecalculateTotals"/>.</summary>
public sealed record OrderPricingSettings(decimal ServiceChargePercent, decimal TaxPercent)
{
    public static readonly OrderPricingSettings None = new(0m, 0m);
}
