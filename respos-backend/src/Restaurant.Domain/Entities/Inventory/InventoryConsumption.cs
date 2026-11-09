using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Inventory;

/// <summary>One row per paid order (unique OrderId) — guarantees idempotent ingredient consumption.</summary>
public class InventoryConsumption : Entity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OrderId { get; set; }
    public string RecipeVersionsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; }
}

/// <summary>Inventarization document; completing it creates inventory_count adjustments.</summary>
public partial class InventoryCount : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public InventoryCountStatus Status { get; set; } = InventoryCountStatus.Draft;
    public string? Comment { get; set; }
    public DateTime? CompletedAt { get; set; }

    public ICollection<InventoryCountLine> Lines { get; set; } = [];
}

public class InventoryCountLine : Entity
{
    public Guid InventoryCountId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal ExpectedQty { get; set; }
    public decimal? CountedQty { get; set; }

    public Ingredient? Ingredient { get; set; }
}
