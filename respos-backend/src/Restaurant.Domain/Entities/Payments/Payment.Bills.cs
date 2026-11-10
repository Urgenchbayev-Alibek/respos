namespace Restaurant.Domain.Entities.Payments;

/// <summary>F2: bill reference and tip. The tip is NOT part of <see cref="Payment.Amount"/> (not order total, not revenue).</summary>
public partial class Payment
{
    /// <summary>Bill of a split order this payment belongs to (null = whole order, v1 behaviour).</summary>
    public Guid? BillId { get; set; }

    /// <summary>Tip on top of the amount; credited to the order's waiter; not refundable in MVP.</summary>
    public decimal TipAmount { get; set; }
}
