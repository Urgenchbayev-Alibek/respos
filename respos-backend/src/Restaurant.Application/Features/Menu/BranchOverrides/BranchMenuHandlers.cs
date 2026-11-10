using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.BranchOverrides;

/// <summary><c>GET /menu/items/{id}/branches</c>: one row per active branch (org-level, menu.read).</summary>
public sealed class GetBranchMenuItemsHandler(ITenantContext tenant, BranchMenuReader reader)
    : IHandler<GetBranchMenuItemsQuery, IReadOnlyList<BranchMenuItemDto>>
{
    public async Task<Result<IReadOnlyList<BranchMenuItemDto>>> HandleAsync(GetBranchMenuItemsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var item = await reader.LoadItemAsync(request.MenuItemId, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        return Result.Success(await reader.BuildAsync(item, null, cancellationToken));
    }
}

/// <summary>
/// Upserts (or removes, when empty) the override of one item in one branch of the org. The station must be an active
/// station of THAT branch (404 <c>kitchen_station.not_found</c>); variants must belong to the item (400 <c>menu_item.invalid_variant</c>).
/// </summary>
public sealed class SaveBranchMenuItemHandler(IApplicationDbContext db, ITenantContext tenant, BranchMenuReader reader, IAuditLogger audit)
    : IHandler<SaveBranchMenuItemCommand, BranchMenuItemDto>
{
    public async Task<Result<BranchMenuItemDto>> HandleAsync(SaveBranchMenuItemCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var item = await reader.LoadItemAsync(request.MenuItemId, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        if (item.IsArchived)
        {
            return MenuErrors.ItemArchived;
        }

        if (!await db.Branches.AnyAsync(b => b.Id == request.BranchId && b.IsActive, cancellationToken))
        {
            return BranchErrors.NotFound;
        }

        if (request.KitchenStationId is { } stationId && !await db.KitchenStations.AnyAsync(
                s => s.Id == stationId && s.BranchId == request.BranchId && s.IsActive && !s.IsArchived, cancellationToken))
        {
            return MenuErrors.StationNotFound;
        }

        var variantPrices = request.VariantPrices ?? [];
        var variantIds = item.Variants.Where(v => !v.IsArchived).Select(v => v.Id).ToHashSet();
        if (variantPrices.Any(v => !variantIds.Contains(v.VariantId)))
        {
            return MenuErrors.InvalidVariant;
        }

        var row = await BranchOverrideRows.GetOrAddAsync(db, orgId, request.BranchId, item.Id, cancellationToken);
        row.PriceOverride = request.PriceOverride;
        row.IsAvailable = request.IsAvailable;
        row.KitchenStationId = request.KitchenStationId;
        db.BranchMenuItemVariantPrices.RemoveRange(row.VariantPrices);
        row.VariantPrices.Clear();
        foreach (var price in variantPrices)
        {
            var entity = new BranchMenuItemVariantPrice { BranchMenuItemId = row.Id, VariantId = price.VariantId, Price = price.Price };
            row.VariantPrices.Add(entity);
            db.BranchMenuItemVariantPrices.Add(entity);
        }

        BranchOverrideRows.RemoveIfEmpty(db, row);
        audit.Log("menu_item.branch_override_saved", nameof(MenuItem), item.Id, new
        {
            request.BranchId, request.PriceOverride, request.IsAvailable, request.KitchenStationId, variants = variantPrices.Count,
        });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.BuildAsync(item, request.BranchId, cancellationToken))[0];
    }
}

/// <summary><c>DELETE /menu/items/{id}/branches/{branchId}</c>: the branch inherits everything again (idempotent).</summary>
public sealed class ResetBranchMenuItemHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<ResetBranchMenuItemCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ResetBranchMenuItemCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        if (!await db.MenuItems.AnyAsync(i => i.Id == request.MenuItemId, cancellationToken))
        {
            return MenuErrors.ItemNotFound;
        }

        var row = await db.BranchMenuItems
            .FirstOrDefaultAsync(b => b.BranchId == request.BranchId && b.MenuItemId == request.MenuItemId, cancellationToken);
        if (row is not null)
        {
            db.BranchMenuItems.Remove(row); // variant prices cascade
            audit.Log("menu_item.branch_override_reset", nameof(MenuItem), request.MenuItemId, new { request.BranchId });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Unit.Value;
    }
}

/// <summary><c>PUT /menu/branch-availability/{menuItemId}</c>: stop-list quick toggle for the X-Branch-Id branch.</summary>
public sealed class SetBranchAvailabilityHandler(IApplicationDbContext db, ITenantContext tenant, BranchMenuReader reader, IAuditLogger audit)
    : IHandler<SetBranchAvailabilityCommand, BranchMenuItemDto>
{
    public async Task<Result<BranchMenuItemDto>> HandleAsync(SetBranchAvailabilityCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var item = await reader.LoadItemAsync(request.MenuItemId, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        if (item.IsArchived)
        {
            return MenuErrors.ItemArchived;
        }

        var row = await BranchOverrideRows.GetOrAddAsync(db, orgId, branchId, item.Id, cancellationToken);
        row.IsAvailable = request.IsAvailable == item.IsAvailable ? null : request.IsAvailable; // equal to org value → inherit
        BranchOverrideRows.RemoveIfEmpty(db, row);
        audit.Log("menu_item.branch_availability_changed", nameof(MenuItem), item.Id, new { branchId, request.IsAvailable });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.BuildAsync(item, branchId, cancellationToken))[0];
    }
}

internal static class BranchOverrideRows
{
    public static async Task<BranchMenuItem> GetOrAddAsync(
        IApplicationDbContext db, Guid organizationId, Guid branchId, Guid menuItemId, CancellationToken cancellationToken)
    {
        var row = await db.BranchMenuItems.Include(b => b.VariantPrices)
            .FirstOrDefaultAsync(b => b.BranchId == branchId && b.MenuItemId == menuItemId, cancellationToken);
        if (row is null)
        {
            row = new BranchMenuItem { OrganizationId = organizationId, BranchId = branchId, MenuItemId = menuItemId };
            db.BranchMenuItems.Add(row);
        }

        return row;
    }

    public static void RemoveIfEmpty(IApplicationDbContext db, BranchMenuItem row)
    {
        if (row.IsEmpty)
        {
            db.BranchMenuItems.Remove(row);
        }
    }
}
