using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Recipes;

public static class RecipeErrors
{
    public static readonly Error NotFound = Error.NotFound("recipe.not_found", "Recipe not found.");
    public static readonly Error MenuItemNotFound = Error.NotFound("menu_item.not_found", "Menu item not found.");

    public static readonly Error InvalidVariant =
        Error.BusinessRule("recipe.invalid_variant", "The variant does not belong to the menu item.");
}
