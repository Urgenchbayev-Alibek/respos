using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Customers;

/// <summary>
/// Points balance of one customer + append-only ledger. Positive entries are "lots" with <see cref="LoyaltyTransaction.RemainingPoints"/>;
/// redemptions, reversals and expiry consume lots FIFO (earliest expiry first). Invariant: Balance = Σ lot.RemainingPoints ≥ 0.
/// Only open lots need to be loaded into <see cref="Transactions"/> for the operations below.
/// </summary>
public class LoyaltyAccount : Entity, ITenantScoped
{
    private LoyaltyAccount()
    {
    }

    public Guid OrganizationId { get; set; }
    public Guid CustomerId { get; private set; }
    public decimal Balance { get; private set; }
    public decimal LifetimeEarned { get; private set; }
    public decimal LifetimeRedeemed { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c> (two cashiers redeeming at once → 409).</summary>
    public uint RowVersion { get; private set; }

    public List<LoyaltyTransaction> Transactions { get; private set; } = [];

    public static LoyaltyAccount Open(Guid organizationId, Guid customerId, DateTime utcNow) =>
        new() { OrganizationId = organizationId, CustomerId = customerId, CreatedAt = utcNow };

    public LoyaltyTransaction Earn(Guid orderId, decimal points, DateTime? expiresAt, DateTime utcNow, Guid? by)
    {
        EnsureWhole(points);
        LifetimeEarned += points;
        return AddLot(LoyaltyTransactionType.Earn, LoyaltyReason.OrderPaid, orderId, points, expiresAt, utcNow, by);
    }

    /// <summary>Spends points on an order (as a discount). Throws when the balance is insufficient.</summary>
    public LoyaltyTransaction Redeem(Guid orderId, decimal points, DateTime utcNow, Guid? by)
    {
        EnsureWhole(points);
        if (points > Balance)
        {
            throw new DomainException(LoyaltyErrors.InsufficientPoints);
        }

        Consume(points, preferredOrderId: null);
        LifetimeRedeemed += points;
        return AddEntry(LoyaltyTransactionType.Redeem, LoyaltyReason.OrderRedeemed, orderId, -points, utcNow, by);
    }

    /// <summary>Gives redeemed points back (cancelled redemption/order, refund, reconcile) as a new lot.</summary>
    public LoyaltyTransaction? ReturnRedeemed(Guid orderId, decimal points, LoyaltyReason reason, DateTime? expiresAt, DateTime utcNow, Guid? by)
    {
        if (points <= 0)
        {
            return null;
        }

        EnsureWhole(points);
        LifetimeRedeemed = Math.Max(0m, LifetimeRedeemed - points);
        return AddLot(LoyaltyTransactionType.Reverse, reason, orderId, points, expiresAt, utcNow, by);
    }

    /// <summary>
    /// Takes earned points back (refund). Uses the order's own lot first, then others; capped at the balance
    /// (already spent points are not clawed back below zero). Returns null when nothing could be taken.
    /// </summary>
    public LoyaltyTransaction? ReverseEarned(Guid orderId, decimal points, DateTime utcNow, Guid? by)
    {
        var actual = Math.Min(points, Balance);
        if (actual <= 0)
        {
            return null;
        }

        EnsureWhole(actual);
        Consume(actual, preferredOrderId: orderId);
        LifetimeEarned = Math.Max(0m, LifetimeEarned - actual);
        return AddEntry(LoyaltyTransactionType.Reverse, LoyaltyReason.Refund, orderId, -actual, utcNow, by);
    }

    /// <summary>Writes <c>expire</c> entries for lots whose expiry passed; returns them.</summary>
    public IReadOnlyList<LoyaltyTransaction> ExpireDue(DateTime utcNow)
    {
        var due = Transactions.Where(t => t.RemainingPoints > 0 && t.ExpiresAt <= utcNow).ToList();
        var written = new List<LoyaltyTransaction>(due.Count);
        foreach (var lot in due)
        {
            var points = lot.RemainingPoints;
            lot.RemainingPoints = 0;
            Balance -= points;
            written.Add(AddEntry(LoyaltyTransactionType.Expire, LoyaltyReason.Expiry, lot.OrderId, -points, utcNow, null));
        }

        return written;
    }

    private void Consume(decimal points, Guid? preferredOrderId)
    {
        var lots = Transactions
            .Where(t => t.RemainingPoints > 0)
            .OrderBy(t => preferredOrderId is not null && t.OrderId == preferredOrderId ? 0 : 1)
            .ThenBy(t => t.ExpiresAt ?? DateTime.MaxValue)
            .ThenBy(t => t.CreatedAt)
            .ToList();
        var left = points;
        foreach (var lot in lots)
        {
            var take = Math.Min(left, lot.RemainingPoints);
            lot.RemainingPoints -= take;
            left -= take;
            if (left == 0)
            {
                break;
            }
        }

        if (left > 0)
        {
            throw new InvalidOperationException("Loyalty lots are not loaded: balance and lots disagree.");
        }

        Balance -= points;
    }

    private LoyaltyTransaction AddLot(
        LoyaltyTransactionType type, LoyaltyReason reason, Guid orderId, decimal points, DateTime? expiresAt, DateTime utcNow, Guid? by)
    {
        Balance += points;
        var entry = AddEntry(type, reason, orderId, points, utcNow, by);
        entry.RemainingPoints = points;
        entry.ExpiresAt = expiresAt;
        return entry;
    }

    private LoyaltyTransaction AddEntry(
        LoyaltyTransactionType type, LoyaltyReason reason, Guid? orderId, decimal points, DateTime utcNow, Guid? by)
    {
        var entry = new LoyaltyTransaction
        {
            OrganizationId = OrganizationId,
            AccountId = Id,
            CustomerId = CustomerId,
            OrderId = orderId,
            Type = type,
            Reason = reason,
            Points = points,
            BalanceAfter = Balance,
            CreatedAt = utcNow,
            CreatedBy = by,
        };
        Transactions.Add(entry);
        UpdatedAt = utcNow;
        return entry;
    }

    private static void EnsureWhole(decimal points)
    {
        if (points <= 0 || points != Math.Floor(points))
        {
            throw new DomainException(LoyaltyErrors.InvalidPoints);
        }
    }
}

/// <summary>Ledger entry. Unique (OrderId, Type) for <c>earn</c> makes earning idempotent per order.</summary>
public class LoyaltyTransaction : Entity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid AccountId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid? OrderId { get; set; }
    public LoyaltyTransactionType Type { get; set; }
    public LoyaltyReason Reason { get; set; }

    /// <summary>Signed points of this entry.</summary>
    public decimal Points { get; set; }

    public decimal BalanceAfter { get; set; }

    /// <summary>Unspent part of a positive entry (lot); 0 for negative entries.</summary>
    public decimal RemainingPoints { get; set; }

    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
}
