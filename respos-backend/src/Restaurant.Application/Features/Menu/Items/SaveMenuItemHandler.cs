using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.Items;

/// <summary>
/// Create (Id null) or update a menu item with variants, modifier group links and availability windows.
/// Variants dropped from the request are archived when orders/recipes use them, otherwise removed.
/// Null collections on update mean "leave unchanged".
/// </summary>
public sealed class SaveMenuItemHandler(
    IApplicationDbContext db, ITenantContext tenant, MenuReadService reader, MenuUsageService usage, IClock clock, IAuditLogger audit)
    : IHandler<SaveMenuItemCommand, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> HandleAsync(SaveMenuItemCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var references = await ValidateReferencesAsync(request, cancellationToken);
        if (references.IsFailure)
        {
            return references.Error;
        }

        MenuItem item;
        if (request.Id is { } id)
        {
            var existing = await reader.ItemsWithDetails(tracking: true).FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
            if (existing is null)
            {
                return MenuErrors.ItemNotFound;
            }

            if (existing.IsArchived)
            {
                return MenuErrors.ItemArchived;
            }

            item = existing;
        }
        else
        {
            item = new MenuItem();
            db.MenuItems.Add(item);
        }

        var oldPrice = item.Price;
        item.CategoryId = request.CategoryId;
        item.Name = request.Name.Trim();
        item.NameUz = Clean(request.NameUz);
        item.Description = Clean(request.Description);
        item.Price = request.Price;
        item.PrepTimeMinutes = request.PrepTimeMinutes;
        item.KitchenStationId = request.KitchenStationId;
        item.IsAvailable = request.IsAvailable ?? item.IsAvailable;
        item.Sku = Clean(request.Sku);

        if (request.Variants is { } variants)
        {
            var variantResult = await SyncVariantsAsync(item, variants, cancellationToken);
            if (variantResult.IsFailure)
            {
                return variantResult.Error;
            }
        }

        if (request.ModifierGroupIds is { } groupIds)
        {
            SyncModifierGroups(item, groupIds);
        }

        if (request.Availability is { } windows)
        {
            db.MenuAvailabilities.RemoveRange(item.Availability);
            db.MenuAvailabilities.AddRange(windows.Select(w => new MenuAvailability
            {
                MenuItemId = item.Id, DayOfWeek = w.DayOfWeek, StartTime = w.StartTime, EndTime = w.EndTime,
            }));
        }

        audit.Log(request.Id is null ? "menu_item.created" : "menu_item.updated", nameof(MenuItem), item.Id,
            new { request.Name, request.Price, oldPrice = request.Id is null ? (decimal?)null : oldPrice, request.CategoryId });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetItemAsync(item.Id, cancellationToken))!;
    }

    private async Task<Result> ValidateReferencesAsync(SaveMenuItemCommand request, CancellationToken cancellationToken)
    {
        var category = await db.MenuCategories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
        if (category is null)
        {
            return MenuErrors.CategoryNotFound;
        }

        if (category.IsArchived)
        {
            return MenuErrors.CategoryArchived;
        }

        if (request.KitchenStationId is { } stationId
            && !await db.KitchenStations.AnyAsync(s => s.Id == stationId && !s.IsArchived, cancellationToken))
        {
            return MenuErrors.StationNotFound;
        }

        if (request.ModifierGroupIds is { Count: > 0 } groupIds)
        {
            var found = await db.ModifierGroups.CountAsync(g => groupIds.Contains(g.Id) && !g.IsArchived, cancellationToken);
            if (found != groupIds.Count)
            {
                return MenuErrors.InvalidModifierGroups;
            }
        }

        return Result.Success();
    }

    private async Task<Result> SyncVariantsAsync(MenuItem item, IReadOnlyList<MenuItemVariantInput> inputs, CancellationToken cancellationToken)
    {
        var current = item.Variants.Where(v => !v.IsArchived).ToDictionary(v => v.Id);
        if (inputs.Any(v => v.Id is { } variantId && !current.ContainsKey(variantId)))
        {
            return MenuErrors.InvalidVariant;
        }

        var keep = inputs.Where(v => v.Id != null).Select(v => v.Id!.Value).ToHashSet();
        foreach (var removed in current.Values.Where(v => !keep.Contains(v.Id)))
        {
            if (await usage.IsVariantUsedAsync(removed.Id, cancellationToken))
            {
                removed.IsDefault = false;
                removed.Archive(clock.UtcNow);
            }
            else
            {
                db.MenuItemVariants.Remove(removed);
            }
        }

        foreach (var input in inputs)
        {
            var variant = input.Id is { } variantId ? current[variantId] : new MenuItemVariant { MenuItemId = item.Id };
            variant.Name = input.Name.Trim();
            variant.Price = input.Price;
            variant.IsDefault = input.IsDefault;
            if (input.Id is null)
            {
                db.MenuItemVariants.Add(variant);
            }
        }

        return Result.Success();
    }

    private void SyncModifierGroups(MenuItem item, IReadOnlyList<Guid> groupIds)
    {
        var existing = item.ModifierGroups.ToDictionary(l => l.ModifierGroupId);
        db.MenuItemModifierGroups.RemoveRange(existing.Values.Where(l => !groupIds.Contains(l.ModifierGroupId)));
        for (var index = 0; index < groupIds.Count; index++)
        {
            if (existing.TryGetValue(groupIds[index], out var link))
            {
                link.SortOrder = index;
            }
            else
            {
                db.MenuItemModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = item.Id, ModifierGroupId = groupIds[index], SortOrder = index });
            }
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
