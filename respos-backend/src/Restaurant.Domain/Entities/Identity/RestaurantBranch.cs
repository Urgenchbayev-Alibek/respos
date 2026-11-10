using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Identity;

public class RestaurantBranch : AuditableEntity, ITenantScoped
{
    public const string DefaultTimezone = "Asia/Tashkent";

    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string Timezone { get; set; } = DefaultTimezone;
    public bool IsActive { get; set; } = true;

    /// <summary>Globally unique public address of the QR menu (<c>/menu/{slug}</c>); see <see cref="BranchSlug"/>.</summary>
    public string? Slug { get; set; }

    public Organization? Organization { get; set; }
    public BranchSettings? Settings { get; set; }
}

/// <summary>1:1 with <see cref="RestaurantBranch"/>.</summary>
public class BranchSettings : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public decimal ServiceChargePercent { get; set; }
    public decimal TaxPercent { get; set; }
    public bool AllowNegativeStock { get; set; }
    public InventoryConsumptionTrigger InventoryConsumptionTrigger { get; set; } = InventoryConsumptionTrigger.OnPayment;
    public string? ReceiptFooter { get; set; }

    /// <summary>Fee added to every new delivery order of the branch (snapshot on the order).</summary>
    public decimal DeliveryFee { get; set; }

    public RestaurantBranch? Branch { get; set; }
}
