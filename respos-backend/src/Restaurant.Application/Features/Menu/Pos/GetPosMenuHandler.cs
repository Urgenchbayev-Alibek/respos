using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Menu.BranchOverrides;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Menu.Pos;

public sealed record GetPosMenuQuery;

/// <summary>
/// Waiter screen menu in one call: active, non-archived categories with items that are orderable right now
/// (not archived, available, inside a MenuAvailability window in the branch timezone). Empty categories are omitted.
/// Prices, availability and stations are the branch-effective values (<see cref="BranchMenuResolver"/>).
/// </summary>
public sealed class GetPosMenuHandler(
    IApplicationDbContext db, ITenantContext tenant, MenuReadService reader, BranchTimeService branchTime, BranchMenuResolver branchMenu)
    : IHandler<GetPosMenuQuery, IReadOnlyList<PosCategoryDto>>
{
    public async Task<Result<IReadOnlyList<PosCategoryDto>>> HandleAsync(GetPosMenuQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var localNow = await branchTime.LocalNowAsync(branchId, cancellationToken);
        var categories = await db.MenuCategories.AsNoTracking()
            .Where(c => !c.IsArchived && c.IsActive)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);
        var categoryIds = categories.Select(c => c.Id).ToList();
        var items = await reader.ItemsWithDetails()
            .Where(i => !i.IsArchived && categoryIds.Contains(i.CategoryId))
            .OrderBy(i => i.Name)
            .ToListAsync(cancellationToken);
        await branchMenu.ApplyAsync(branchId, items, cancellationToken);
        var byCategory = items.Where(i => i.IsOrderableAt(localNow)).ToLookup(i => i.CategoryId);

        return categories
            .Where(c => byCategory.Contains(c.Id))
            .Select(c => new PosCategoryDto(c.Id, c.Name, c.NameUz, c.SortOrder, byCategory[c.Id].Select(MenuReadService.ToDto).ToList()))
            .ToList();
    }
}
