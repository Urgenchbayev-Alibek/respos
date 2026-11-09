using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Recipes;

/// <summary>Versioned recipe. Only one active version per (MenuItemId, VariantId); new version = new row.</summary>
public class Recipe : AuditableEntity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid MenuItemId { get; set; }
    public Guid? VariantId { get; set; }
    public int Version { get; set; } = 1;
    public DateTime EffectiveFrom { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<RecipeIngredient> Ingredients { get; set; } = [];
}

/// <summary>Quantity in <see cref="UnitId"/>; converted to the ingredient base unit on consumption.</summary>
public class RecipeIngredient : Entity
{
    public Guid RecipeId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }

    public Inventory.Ingredient? Ingredient { get; set; }
    public Inventory.UnitOfMeasure? Unit { get; set; }
}
