using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;

namespace Restaurant.Application.Features.PublicMenu.Menu;

public sealed record GetPublicMenuQuery(string BranchSlug);

public sealed record PublicMenuBranchDto(string Slug, string Name, string? Address, string? Phone);

public sealed record PublicMenuVariantDto(Guid Id, string Name, decimal Price);

public sealed record PublicMenuItemDto(
    Guid Id, string Name, string? NameUz, string? Description, string? PhotoUrl, decimal Price, IReadOnlyList<PublicMenuVariantDto> Variants);

public sealed record PublicMenuCategoryDto(Guid Id, string Name, string? NameUz, IReadOnlyList<PublicMenuItemDto> Items);

/// <summary>Anonymous menu of one branch: only active categories and available, non-archived items of the branch's organization.</summary>
public sealed record PublicMenuDto(
    string OrganizationName,
    string Currency,
    bool IsDemo,
    PublicMenuBranchDto Branch,
    IReadOnlyList<PublicMenuCategoryDto> Categories);

/// <summary>Menu + strong validator of its content (quoted, for the <c>ETag</c> header).</summary>
public sealed record PublicMenuResult(PublicMenuDto Menu, string ETag);

/// <summary>
/// <c>GET /public/menu/{branchSlug}</c> (no tenant): resolves the branch by its globally unique slug and reads only
/// that organization's data (explicit OrganizationId, query filters bypassed). Cached in memory for
/// <see cref="CacheDuration"/>; unknown/inactive branch or suspended organization → 404 <c>public_menu.not_found</c>.
/// </summary>
public sealed class GetPublicMenuHandler(IApplicationDbContext db, IMemoryCache cache) : IHandler<GetPublicMenuQuery, PublicMenuResult>
{
    public static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    public async Task<Result<PublicMenuResult>> HandleAsync(GetPublicMenuQuery request, CancellationToken cancellationToken)
    {
        var slug = request.BranchSlug.Trim().ToLowerInvariant();
        var key = $"public-menu:{slug}";
        if (cache.TryGetValue(key, out PublicMenuResult? cached) && cached is not null)
        {
            return cached;
        }

        var menu = await LoadAsync(slug, cancellationToken);
        if (menu is null)
        {
            return DeliveryErrors.MenuNotFound;
        }

        var hash = SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(menu));
        var result = new PublicMenuResult(menu, $"\"{Convert.ToHexString(hash, 0, 16).ToLowerInvariant()}\"");
        cache.Set(key, result, CacheDuration);
        return result;
    }

    private async Task<PublicMenuDto?> LoadAsync(string slug, CancellationToken ct)
    {
        var branch = await db.Branches.IgnoreQueryFilters().AsNoTracking()
            .Where(b => b.Slug == slug && b.IsActive && b.Organization!.Status == Domain.Enums.OrganizationStatus.Active)
            .Select(b => new
            {
                b.OrganizationId, b.Slug, b.Name, b.Address, b.Phone,
                OrgName = b.Organization!.Name, b.Organization.Currency, b.Organization.IsDemo,
            })
            .FirstOrDefaultAsync(ct);
        if (branch is null)
        {
            return null;
        }

        var categories = await db.MenuCategories.IgnoreQueryFilters().AsNoTracking()
            .Where(c => c.OrganizationId == branch.OrganizationId && c.IsActive && !c.IsArchived)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.NameUz })
            .ToListAsync(ct);
        var categoryIds = categories.Select(c => c.Id).ToList();
        var items = await db.MenuItems.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.OrganizationId == branch.OrganizationId && categoryIds.Contains(i.CategoryId) && i.IsAvailable && !i.IsArchived)
            .Include(i => i.Variants)
            .OrderBy(i => i.Name)
            .ToListAsync(ct);
        var byCategory = items.ToLookup(i => i.CategoryId);

        return new PublicMenuDto(
            branch.OrgName, branch.Currency, branch.IsDemo,
            new PublicMenuBranchDto(branch.Slug!, branch.Name, branch.Address, branch.Phone),
            categories
                .Select(c => new PublicMenuCategoryDto(c.Id, c.Name, c.NameUz, byCategory[c.Id]
                    .Select(i => new PublicMenuItemDto(i.Id, i.Name, i.NameUz, i.Description, i.PhotoUrl, i.Price,
                        i.Variants.Where(v => !v.IsArchived).OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price)
                            .Select(v => new PublicMenuVariantDto(v.Id, v.Name, v.Price)).ToList()))
                    .ToList()))
                .Where(c => c.Items.Count > 0)
                .ToList());
    }
}
