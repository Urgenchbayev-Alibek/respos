using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Menu;

/// <summary>
/// Per-branch override of an org-level <see cref="MenuItem"/> (unique per branch + item). Null fields inherit the
/// item's values. Applied by the application-level resolver to the POS menu, order item snapshots and kitchen routing.
/// </summary>
public class BranchMenuItem : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid MenuItemId { get; set; }

    /// <summary>Base price in this branch (variants without their own override keep their org price).</summary>
    public decimal? PriceOverride { get; set; }

    /// <summary>Branch stop-list: false = not orderable here, true = orderable even if the item is globally off.</summary>
    public bool? IsAvailable { get; set; }

    /// <summary>Kitchen station of THIS branch the item is routed to.</summary>
    public Guid? KitchenStationId { get; set; }

    public MenuItem? MenuItem { get; set; }
    public ICollection<BranchMenuItemVariantPrice> VariantPrices { get; set; } = [];

    public bool IsEmpty => PriceOverride is null && IsAvailable is null && KitchenStationId is null && VariantPrices.Count == 0;

    /// <summary>
    /// Overwrites the effective values on a DETACHED (no-tracking) menu item: price, availability, station and
    /// variant prices. Archived items stay unavailable.
    /// </summary>
    public void ApplyTo(MenuItem item)
    {
        if (item.Id != MenuItemId)
        {
            throw new InvalidOperationException("Branch override does not belong to this menu item.");
        }

        if (PriceOverride is { } price)
        {
            item.Price = price;
        }

        if (IsAvailable is { } available)
        {
            item.IsAvailable = available && !item.IsArchived;
        }

        if (KitchenStationId is { } stationId)
        {
            item.KitchenStationId = stationId;
        }

        foreach (var variant in item.Variants)
        {
            var overridePrice = VariantPrices.FirstOrDefault(v => v.VariantId == variant.Id);
            if (overridePrice is not null)
            {
                variant.Price = overridePrice.Price;
            }
        }
    }
}

/// <summary>Absolute price of one variant in one branch.</summary>
public class BranchMenuItemVariantPrice : Entity
{
    public Guid BranchMenuItemId { get; set; }
    public Guid VariantId { get; set; }
    public decimal Price { get; set; }
}
