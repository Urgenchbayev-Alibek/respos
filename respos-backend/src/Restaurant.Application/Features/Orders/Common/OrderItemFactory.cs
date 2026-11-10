using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.BranchOverrides;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Orders;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>
/// Turns <see cref="AddItemRequest"/>s into order items with snapshots (BR-6.2/6.3): name, variant name,
/// unit price = variant price else item price, modifiers with price deltas. Validates availability (BR-6.5 → 422)
/// and modifier groups min/max/required (BR-6.4 → 400 validation.failed). Price, availability and kitchen station are the
/// current branch's effective values (<see cref="BranchMenuResolver"/>); the station snapshot drives send-to-kitchen routing.
/// </summary>
[ScopedService]
public sealed class OrderItemFactory(IApplicationDbContext db, ITenantContext tenant, BranchMenuResolver branchMenu)
{
    public async Task<Result<List<OrderItem>>> BuildAsync(IReadOnlyList<AddItemRequest> requests, DateTime branchLocalNow, CancellationToken ct)
    {
        var menuIds = requests.Select(r => r.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems.AsNoTracking()
            .Where(m => menuIds.Contains(m.Id))
            .Include(m => m.Variants)
            .Include(m => m.Availability)
            .Include(m => m.ModifierGroups).ThenInclude(g => g.ModifierGroup!).ThenInclude(g => g.Options)
            .AsSplitQuery()
            .ToDictionaryAsync(m => m.Id, ct);
        await branchMenu.ApplyAsync(tenant.RequireBranchId(), menuItems.Values, ct);

        var items = new List<OrderItem>(requests.Count);
        for (var index = 0; index < requests.Count; index++)
        {
            var request = requests[index];
            if (!menuItems.TryGetValue(request.MenuItemId, out var menuItem) || !IsOrderable(menuItem, branchLocalNow))
            {
                return OrderErrors.MenuItemUnavailable with
                {
                    Details = new Dictionary<string, string[]> { [$"items[{index}].menuItemId"] = ["Menu item is not available."] },
                };
            }

            var built = Build(menuItem, request, $"items[{index}]");
            if (built.IsFailure)
            {
                return built.Error;
            }

            items.Add(built.Value);
        }

        return items;
    }

    private static bool IsOrderable(MenuItem item, DateTime localNow)
    {
        if (item.IsArchived || !item.IsAvailable)
        {
            return false;
        }

        if (item.Availability.Count == 0)
        {
            return true;
        }

        var time = TimeOnly.FromDateTime(localNow);
        return item.Availability.Any(a =>
            (a.DayOfWeek is null || a.DayOfWeek == localNow.DayOfWeek)
            && (a.StartTime <= a.EndTime ? time >= a.StartTime && time < a.EndTime : time >= a.StartTime || time < a.EndTime));
    }

    private static Result<OrderItem> Build(MenuItem menuItem, AddItemRequest request, string path)
    {
        MenuItemVariant? variant = null;
        if (request.VariantId is { } variantId)
        {
            variant = menuItem.Variants.FirstOrDefault(v => v.Id == variantId && !v.IsArchived);
            if (variant is null)
            {
                return Invalid($"{path}.variantId", "Variant does not belong to the menu item.");
            }
        }

        var groups = menuItem.ModifierGroups
            .Select(link => link.ModifierGroup)
            .Where(g => g is { IsArchived: false })
            .Select(g => g!)
            .ToList();
        var optionIds = (request.ModifierOptionIds ?? []).Distinct().ToList();
        var options = groups.SelectMany(g => g.Options.Where(o => !o.IsArchived)).ToDictionary(o => o.Id);
        if (optionIds.Any(id => !options.ContainsKey(id)))
        {
            return Invalid($"{path}.modifierOptionIds", "Modifier option does not belong to the menu item.");
        }

        foreach (var group in groups)
        {
            var selected = optionIds.Count(id => options[id].GroupId == group.Id);
            var min = group.IsRequired ? Math.Max(1, group.MinSelect) : group.MinSelect;
            if (selected < min || (group.MaxSelect > 0 && selected > group.MaxSelect))
            {
                return Invalid($"{path}.modifierOptionIds",
                    $"Group '{group.Name}' requires between {min} and {group.MaxSelect} options.");
            }
        }

        var item = OrderItem.Create(
            menuItem.Id, menuItem.Name, variant?.Price ?? menuItem.Price, request.Quantity,
            variant?.Id, variant?.Name, menuItem.KitchenStationId, NullIfEmpty(request.Comment));
        foreach (var id in optionIds)
        {
            item.AddModifier(id, options[id].Name, options[id].PriceDelta);
        }

        return item;
    }

    private static Error Invalid(string field, string message) =>
        Error.Validation("validation.failed", "One or more fields are invalid.") with
        {
            Details = new Dictionary<string, string[]> { [field] = [message] },
        };

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
