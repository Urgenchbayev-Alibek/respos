using Restaurant.Domain.Common;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Customers;

/// <summary>
/// Loyalty program of an organization (one row per org; absent = disabled defaults). 1 point = 1 unit of the org currency.
/// Earn: <c>floor(order.total × EarnPercent / 100)</c> when the order subtotal ≥ <see cref="MinOrderAmount"/>.
/// Redeem: up to <see cref="MaxRedeemPercent"/> % of (subtotal − manual discount), same minimum.
/// </summary>
public class LoyaltySettings : AuditableEntity, ITenantScoped
{
    public const int MaxExpiryDays = 3650;

    public Guid OrganizationId { get; set; }
    public bool IsEnabled { get; private set; }
    public decimal EarnPercent { get; private set; } = 5m;
    public decimal MaxRedeemPercent { get; private set; } = 30m;
    public decimal MinOrderAmount { get; private set; }

    /// <summary>Days until earned points expire; null = never.</summary>
    public int? PointsExpiryDays { get; private set; }

    public static LoyaltySettings Default(Guid organizationId) => new() { OrganizationId = organizationId };

    public void Update(bool isEnabled, decimal earnPercent, decimal maxRedeemPercent, decimal minOrderAmount, int? pointsExpiryDays)
    {
        if (earnPercent is < 0 or > 100 || maxRedeemPercent is < 0 or > 100 || minOrderAmount < 0
            || pointsExpiryDays is < 1 or > MaxExpiryDays)
        {
            throw new DomainException(LoyaltyErrors.InvalidSettings);
        }

        IsEnabled = isEnabled;
        EarnPercent = earnPercent;
        MaxRedeemPercent = maxRedeemPercent;
        MinOrderAmount = Money.Round(minOrderAmount);
        PointsExpiryDays = pointsExpiryDays;
    }

    public bool Qualifies(decimal subtotal) => IsEnabled && subtotal > 0 && subtotal >= MinOrderAmount;

    /// <summary>Whole points earned for a paid total.</summary>
    public decimal PointsFor(decimal paidTotal) => Math.Floor(paidTotal * EarnPercent / 100m);

    /// <summary>Max whole points payable on a bill base (subtotal − manual discount).</summary>
    public decimal MaxRedeemFor(decimal billBase) => billBase <= 0 ? 0m : Math.Floor(billBase * MaxRedeemPercent / 100m);

    public DateTime? ExpiryFrom(DateTime utcNow) => PointsExpiryDays is { } days ? utcNow.AddDays(days) : null;
}
