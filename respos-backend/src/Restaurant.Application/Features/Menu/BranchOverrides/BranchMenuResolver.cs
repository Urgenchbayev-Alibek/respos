using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.BranchOverrides;

/// <summary>
/// THE single place that turns org-level menu items into their effective values for one branch
/// (price / variant prices / availability / kitchen station from <see cref="BranchMenuItem"/>).
/// Used by <c>GET /menu/pos</c>, by order item creation (price snapshot + station snapshot used by send-to-kitchen routing)
/// and by the public QR menu, so a guest never sees a price or a dish the branch does not sell.
/// </summary>
[ScopedService]
public sealed class BranchMenuResolver(IApplicationDbContext db)
{
    /// <summary>
    /// Applies the branch overrides in memory. The items MUST be loaded with <c>AsNoTracking()</c>
    /// (otherwise the overridden values would be persisted to the org-level menu).
    /// </summary>
    public async Task ApplyAsync(Guid branchId, IReadOnlyCollection<MenuItem> items, CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return;
        }

        Apply(items, await LoadAsync(branchId, items.Select(i => i.Id).ToList(), cancellationToken));
    }

    /// <summary>
    /// Same resolution for anonymous callers (public QR menu, F3): there is no tenant context, so the tenant query
    /// filter is replaced by the explicit organization + branch of the already validated slug.
    /// </summary>
    public async Task ApplyPublicAsync(Guid organizationId, Guid branchId, IReadOnlyCollection<MenuItem> items, CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return;
        }

        var ids = items.Select(i => i.Id).ToList();
        var overrides = await db.BranchMenuItems.IgnoreQueryFilters().AsNoTracking()
            .Include(b => b.VariantPrices)
            .Where(b => b.OrganizationId == organizationId && b.BranchId == branchId && ids.Contains(b.MenuItemId))
            .ToDictionaryAsync(b => b.MenuItemId, cancellationToken);
        Apply(items, overrides);
    }

    private static void Apply(IReadOnlyCollection<MenuItem> items, Dictionary<Guid, BranchMenuItem> overrides)
    {
        foreach (var item in items)
        {
            if (overrides.TryGetValue(item.Id, out var branchItem))
            {
                branchItem.ApplyTo(item);
            }
        }
    }

    public async Task<Dictionary<Guid, BranchMenuItem>> LoadAsync(Guid branchId, IReadOnlyCollection<Guid> menuItemIds, CancellationToken cancellationToken) =>
        await db.BranchMenuItems.AsNoTracking()
            .Include(b => b.VariantPrices)
            .Where(b => b.BranchId == branchId && menuItemIds.Contains(b.MenuItemId))
            .ToDictionaryAsync(b => b.MenuItemId, cancellationToken);
}
