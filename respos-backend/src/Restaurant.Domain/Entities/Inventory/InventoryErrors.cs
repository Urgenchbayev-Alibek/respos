using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Inventory;

public static class InventoryErrors
{
    public static readonly Error UnitNotFound = Error.NotFound("unit.not_found", "Unit of measure not found.");
    public static readonly Error UnitCodeTaken = Error.Conflict("unit.code_taken", "A unit with this code already exists.");
    public static readonly Error ConversionExists = Error.Conflict("unit.conversion_exists", "This unit conversion already exists.");

    public static readonly Error ConversionMissing =
        Error.BusinessRule("unit.conversion_missing", "No conversion between the given unit and the ingredient base unit.");

    public static readonly Error CategoryNotFound = Error.NotFound("ingredient_category.not_found", "Ingredient category not found.");
    public static readonly Error IngredientNotFound = Error.NotFound("ingredient.not_found", "Ingredient not found.");
    public static readonly Error IngredientArchived = Error.BusinessRule("ingredient.archived", "The ingredient is archived.");

    public static readonly Error BaseUnitLocked =
        Error.Conflict("ingredient.base_unit_locked", "The base unit cannot be changed after stock movements exist.");

    public static readonly Error CountNotFound = Error.NotFound("inventory_count.not_found", "Inventory count not found.");

    public static readonly Error CountCompleted =
        Error.Conflict("inventory_count.completed", "A completed inventory count cannot be changed.");
}
