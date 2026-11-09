using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.Common;

/// <summary>Loads menu items with their children and maps them to DTOs (archived variants/options/groups hidden).</summary>
[ScopedService]
public sealed class MenuReadService(IApplicationDbContext db)
{
    public IQueryable<MenuItem> ItemsWithDetails(bool tracking = false)
    {
        var query = db.MenuItems
            .Include(i => i.Category)
            .Include(i => i.Variants)
            .Include(i => i.Availability)
            .Include(i => i.ModifierGroups).ThenInclude(l => l.ModifierGroup!).ThenInclude(g => g.Options)
            .AsSplitQuery();
        return tracking ? query : query.AsNoTracking();
    }

    public IQueryable<ModifierGroup> GroupsWithOptions(bool tracking = false)
    {
        var query = db.ModifierGroups.Include(g => g.Options);
        return tracking ? query : query.AsNoTracking();
    }

    public async Task<MenuItemDto?> GetItemAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await ItemsWithDetails().FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        return item is null ? null : ToDto(item);
    }

    public static MenuItemDto ToDto(MenuItem item) => new(
        item.Id,
        item.CategoryId,
        item.Category?.Name ?? string.Empty,
        item.Name,
        item.NameUz,
        item.Description,
        item.PhotoUrl,
        item.Price,
        item.PrepTimeMinutes,
        item.KitchenStationId,
        item.IsAvailable,
        item.IsArchived,
        item.Sku,
        item.Variants.Where(v => !v.IsArchived)
            .OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Name)
            .Select(v => new MenuItemVariantDto(v.Id, v.Name, v.Price, v.IsDefault)).ToList(),
        item.ModifierGroups.Where(l => l.ModifierGroup is { IsArchived: false })
            .OrderBy(l => l.SortOrder)
            .Select(l => ToDto(l.ModifierGroup!)).ToList(),
        item.Availability.OrderBy(a => a.DayOfWeek).ThenBy(a => a.StartTime)
            .Select(a => new MenuAvailabilityDto(a.DayOfWeek, a.StartTime, a.EndTime)).ToList());

    public static ModifierGroupDto ToDto(ModifierGroup group) => new(
        group.Id,
        group.Name,
        group.MinSelect,
        group.MaxSelect,
        group.IsRequired,
        group.Options.Where(o => !o.IsArchived).OrderBy(o => o.SortOrder).ThenBy(o => o.Name)
            .Select(o => new ModifierOptionDto(o.Id, o.Name, o.PriceDelta)).ToList());
}
