using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.BranchOverrides;

/// <summary>Builds the menu item × branch rows (active branches of the current org) with effective values.</summary>
[ScopedService]
public sealed class BranchMenuReader(IApplicationDbContext db)
{
    public Task<MenuItem?> LoadItemAsync(Guid menuItemId, CancellationToken ct) =>
        db.MenuItems.AsNoTracking().Include(i => i.Variants).FirstOrDefaultAsync(i => i.Id == menuItemId, ct);

    public async Task<IReadOnlyList<BranchMenuItemDto>> BuildAsync(MenuItem item, Guid? onlyBranchId, CancellationToken ct)
    {
        var branches = await db.Branches.AsNoTracking()
            .Where(b => b.IsActive && (onlyBranchId == null || b.Id == onlyBranchId))
            .OrderBy(b => b.CreatedAt).ThenBy(b => b.Name)
            .Select(b => new { b.Id, b.Name })
            .ToListAsync(ct);
        var branchIds = branches.Select(b => b.Id).ToList();
        var overrides = await db.BranchMenuItems.AsNoTracking().Include(b => b.VariantPrices)
            .Where(b => b.MenuItemId == item.Id && branchIds.Contains(b.BranchId))
            .ToDictionaryAsync(b => b.BranchId, ct);
        var stations = await db.KitchenStations.AsNoTracking()
            .Where(s => branchIds.Contains(s.BranchId))
            .Select(s => new StationInfo(s.Id, s.BranchId, s.Name))
            .ToDictionaryAsync(s => s.Id, ct);
        var variants = item.Variants.Where(v => !v.IsArchived).OrderBy(v => v.Price).ThenBy(v => v.Name).ToList();

        return branches.Select(branch =>
        {
            overrides.TryGetValue(branch.Id, out var row);
            Guid? ownStation = item.KitchenStationId is { } s && stations.TryGetValue(s, out var own) && own.BranchId == branch.Id ? s : null;
            string? overrideStationName = row?.KitchenStationId is { } rs && stations.TryGetValue(rs, out var info) ? info.Name : null;
            return new BranchMenuItemDto(
                branch.Id,
                branch.Name,
                item.Id,
                row is not null,
                row?.PriceOverride,
                row?.IsAvailable,
                row?.KitchenStationId,
                overrideStationName,
                row?.PriceOverride ?? item.Price,
                !item.IsArchived && (row?.IsAvailable ?? item.IsAvailable),
                row?.KitchenStationId ?? ownStation,
                variants.Select(v =>
                {
                    var price = row?.VariantPrices.FirstOrDefault(p => p.VariantId == v.Id)?.Price;
                    return new BranchVariantPriceDto(v.Id, v.Name, v.Price, price, price ?? v.Price);
                }).ToList());
        }).ToList();
    }

    private sealed record StationInfo(Guid Id, Guid BranchId, string Name);
}
