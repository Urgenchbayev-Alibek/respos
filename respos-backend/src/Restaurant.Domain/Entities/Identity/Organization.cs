using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Identity;

/// <summary>The tenant. Not ITenantScoped itself: handlers filter by the current organization id explicitly.</summary>
public class Organization : AuditableEntity
{
    public const string DefaultCurrency = "UZS";
    public const string DefaultLanguageCode = "ru";

    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Currency { get; set; } = DefaultCurrency;
    public string DefaultLanguage { get; set; } = DefaultLanguageCode;
    public OrganizationStatus Status { get; set; } = OrganizationStatus.Active;
    public bool IsDemo { get; set; }

    public ICollection<RestaurantBranch> Branches { get; set; } = [];

    public bool IsActive => Status == OrganizationStatus.Active;
}
