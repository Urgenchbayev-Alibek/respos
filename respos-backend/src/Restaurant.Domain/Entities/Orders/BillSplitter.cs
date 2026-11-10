using Restaurant.Domain.Common;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Money allocation for bill splits. Every result sums exactly to the total: each part is rounded
/// (AwayFromZero, 2 decimals) and the rounding remainder goes to the last part.
/// </summary>
public static class BillSplitter
{
    public const int MaxBills = 20;

    public static IReadOnlyList<decimal> Equal(decimal total, int parts)
    {
        if (parts < 2 || parts > MaxBills)
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }

        return Proportional(total, Enumerable.Repeat(1m, parts).ToList());
    }

    /// <summary>Custom amounts must be positive and sum exactly to the total.</summary>
    public static IReadOnlyList<decimal> Custom(decimal total, IReadOnlyList<decimal> amounts)
    {
        if (amounts.Count < 2 || amounts.Count > MaxBills || amounts.Any(a => a <= 0 || a != Money.Round(a)))
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }

        if (amounts.Sum() != total)
        {
            throw new DomainException(OrderBillErrors.SplitMismatch);
        }

        return amounts.ToList();
    }

    /// <summary>part_i = round(total × share_i / Σ shares), last = total − Σ previous; every part must stay &gt; 0.</summary>
    public static IReadOnlyList<decimal> Proportional(decimal total, IReadOnlyList<decimal> shares)
    {
        var sum = shares.Sum();
        if (total <= 0 || shares.Count < 2 || shares.Count > MaxBills || shares.Any(s => s <= 0) || sum <= 0)
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }

        var result = new List<decimal>(shares.Count);
        for (var i = 0; i < shares.Count - 1; i++)
        {
            result.Add(Money.Round(total * shares[i] / sum));
        }

        result.Add(total - result.Sum());
        if (result.Any(a => a <= 0))
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }

        return result;
    }
}
