using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

public partial class Order
{
    /// <summary>
    /// Delivery fee snapshot (branch setting at creation). Always 0 for dine-in/takeaway. Added to the total after tax
    /// (not discounted, no service charge/tax on it): total = subtotal − discount + serviceCharge + tax + deliveryFee.
    /// </summary>
    public decimal DeliveryFee { get; private set; }

    public bool IsDelivery => Type == OrderType.Delivery;

    /// <summary>Sets the delivery fee of a delivery order and recalculates totals.</summary>
    public void SetDeliveryFee(decimal fee, OrderPricingSettings settings)
    {
        EnsureNotClosed();
        EnsureNotSplit();
        if (!IsDelivery || fee < 0)
        {
            throw new DomainException(OrderErrors.InvalidDeliveryFee);
        }

        DeliveryFee = Money.Round(fee);
        RecalculateTotals(settings);
    }
}
