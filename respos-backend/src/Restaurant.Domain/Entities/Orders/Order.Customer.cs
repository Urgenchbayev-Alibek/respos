using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Guest (CRM) link and loyalty points discount of the order (F1). The points discount is part of
/// <see cref="DiscountAmount"/> (manual discount + points, ≤ subtotal); 1 point = 1 currency unit.
/// </summary>
public partial class Order
{
    public Guid? CustomerId { get; private set; }

    /// <summary>Money paid by loyalty points (included in <see cref="DiscountAmount"/>).</summary>
    public decimal LoyaltyDiscountAmount { get; private set; }

    public void AttachCustomer(Guid customerId)
    {
        EnsureNotClosed();
        if (CustomerId == customerId)
        {
            return;
        }

        if (LoyaltyDiscountAmount > 0)
        {
            throw new DomainException(LoyaltyErrors.RedemptionActive);
        }

        CustomerId = customerId;
    }

    public void DetachCustomer()
    {
        EnsureNotClosed();
        if (LoyaltyDiscountAmount > 0)
        {
            throw new DomainException(LoyaltyErrors.RedemptionActive);
        }

        CustomerId = null;
    }

    /// <summary>Manual (non-loyalty) discount for the current subtotal.</summary>
    public decimal ManualDiscountAmount => ManualDiscount(Subtotal);

    /// <summary>Base for the "max % of bill payable by points" rule: subtotal − manual discount.</summary>
    public decimal LoyaltyBase => Math.Max(0m, Subtotal - ManualDiscountAmount);

    public void ApplyLoyaltyDiscount(decimal amount, OrderPricingSettings settings)
    {
        EnsureNotClosed();
        if (CustomerId is null)
        {
            throw new DomainException(LoyaltyErrors.NoCustomer);
        }

        if (LoyaltyDiscountAmount > 0)
        {
            throw new DomainException(LoyaltyErrors.AlreadyRedeemed);
        }

        if (amount <= 0 || amount > LoyaltyBase)
        {
            throw new DomainException(LoyaltyErrors.ExceedsLimit);
        }

        LoyaltyDiscountAmount = amount;
        RecalculateTotals(settings);
        if (Total < PaidAmount)
        {
            throw new DomainException(OrderErrors.InvalidDiscount);
        }
    }

    /// <summary>Removes the points discount; returns the amount that was applied (to give the points back).</summary>
    public decimal ClearLoyaltyDiscount(OrderPricingSettings settings)
    {
        EnsureNotClosed();
        var amount = LoyaltyDiscountAmount;
        if (amount <= 0)
        {
            throw new DomainException(LoyaltyErrors.NothingRedeemed);
        }

        LoyaltyDiscountAmount = 0m;
        RecalculateTotals(settings);
        return amount;
    }
}
