using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

public partial class Order
{
    /// <summary>
    /// Recalculates all money fields (CONVENTIONS.md):
    /// subtotal = sum(lineTotal of non-cancelled items); discount ≤ subtotal;
    /// serviceCharge = round((subtotal − discount) × service%/100, 2);
    /// tax = round((subtotal − discount + serviceCharge) × tax%/100, 2);
    /// total = subtotal − discount + serviceCharge + tax.
    /// </summary>
    public void RecalculateTotals(OrderPricingSettings settings)
    {
        foreach (var item in Items)
        {
            item.RecalculateLineTotal();
        }

        Subtotal = Items.Where(i => i.Status != OrderItemStatus.Cancelled).Sum(i => i.LineTotal);
        DiscountAmount = CalculateDiscount(Subtotal);
        var discounted = Subtotal - DiscountAmount;
        ServiceChargeAmount = Money.Percent(discounted, settings.ServiceChargePercent);
        TaxAmount = Money.Percent(discounted + ServiceChargeAmount, settings.TaxPercent);
        Total = discounted + ServiceChargeAmount + TaxAmount;
    }

    public void ApplyDiscount(DiscountType type, decimal value, OrderPricingSettings settings)
    {
        EnsureNotClosed();
        if (value < 0 || (type == DiscountType.Percent && value > 100))
        {
            throw new DomainException(OrderErrors.InvalidDiscount);
        }

        DiscountType = type;
        DiscountValue = type == DiscountType.None ? 0m : value;
        RecalculateTotals(settings);
        if (Total < PaidAmount)
        {
            throw new DomainException(OrderErrors.InvalidDiscount);
        }
    }

    /// <summary>Manual discount + loyalty points discount (F1), ≤ subtotal. The points part is clamped to what is left.</summary>
    private decimal CalculateDiscount(decimal subtotal)
    {
        var manual = ManualDiscount(subtotal);
        LoyaltyDiscountAmount = Math.Min(LoyaltyDiscountAmount, subtotal - manual);
        return manual + LoyaltyDiscountAmount;
    }

    private decimal ManualDiscount(decimal subtotal)
    {
        var discount = DiscountType switch
        {
            DiscountType.Amount => Money.Round(DiscountValue),
            DiscountType.Percent => Money.Percent(subtotal, DiscountValue),
            _ => 0m,
        };
        return Math.Min(discount, subtotal);
    }
}
