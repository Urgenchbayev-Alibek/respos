using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Menu;

public static class MenuErrors
{
    public static readonly Error CategoryNotFound = Error.NotFound("menu_category.not_found", "Menu category not found.");

    public static readonly Error CategoryArchived = Error.Conflict("menu_category.archived", "The menu category is archived.");

    public static readonly Error CategoryHasItems =
        Error.Conflict("menu_category.has_items", "The category still has menu items. Archive or move them first.");

    public static readonly Error ItemNotFound = Error.NotFound("menu_item.not_found", "Menu item not found.");

    public static readonly Error ItemArchived = Error.Conflict("menu_item.archived", "The menu item is archived.");

    public static readonly Error ModifierGroupNotFound = Error.NotFound("modifier_group.not_found", "Modifier group not found.");

    public static readonly Error InvalidModifierGroups =
        Error.Validation("menu_item.invalid_modifier_groups", "One or more modifier groups do not exist.");

    public static readonly Error InvalidVariant = Error.Validation("menu_item.invalid_variant", "Variant does not belong to the item.");

    public static readonly Error InvalidOption = Error.Validation("modifier_group.invalid_option", "Option does not belong to the group.");

    public static readonly Error InvalidPhoto =
        Error.Validation("menu_item.invalid_photo", "Photo must be a JPG, PNG or WEBP image up to 2 MB.");

    public static readonly Error StationNotFound = Error.NotFound("kitchen_station.not_found", "Kitchen station not found.");

    public static readonly Error StationInUse =
        Error.Conflict("kitchen_station.in_use", "Menu items are still routed to this station.");
}

/// <summary>Modifier group selection rules (BR-6.4), shared by menu validation and order item validation.</summary>
public static class ModifierRules
{
    /// <summary>Group definition: 0 ≤ min ≤ max, max ≥ 1, required ⇒ min ≥ 1, min ≤ option count.</summary>
    public static bool IsValidDefinition(int minSelect, int maxSelect, bool isRequired, int optionCount) =>
        minSelect >= 0 && maxSelect >= 1 && minSelect <= maxSelect && (!isRequired || minSelect >= 1) && minSelect <= optionCount;

    /// <summary>Number of chosen options for an order item is within [MinSelect, MaxSelect].</summary>
    public static bool AllowsSelectionCount(this ModifierGroup group, int selected) =>
        selected >= Math.Max(group.MinSelect, group.IsRequired ? 1 : 0) && selected <= group.MaxSelect;
}
