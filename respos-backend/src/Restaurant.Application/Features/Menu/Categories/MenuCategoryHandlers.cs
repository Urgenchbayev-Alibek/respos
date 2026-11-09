using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.Categories;

/// <summary>Organization menu categories ordered by SortOrder (archived only on request).</summary>
public sealed class ListMenuCategoriesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListMenuCategoriesQuery, IReadOnlyList<MenuCategoryDto>>
{
    public async Task<Result<IReadOnlyList<MenuCategoryDto>>> HandleAsync(ListMenuCategoriesQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        return await db.MenuCategories.AsNoTracking()
            .Where(c => request.IncludeArchived || !c.IsArchived)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new MenuCategoryDto(c.Id, c.Name, c.NameUz, c.SortOrder, c.IsActive, c.IsArchived,
                c.Items.Count(i => !i.IsArchived)))
            .ToListAsync(cancellationToken);
    }
}

public sealed class SaveMenuCategoryHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveMenuCategoryCommand, MenuCategoryDto>
{
    public async Task<Result<MenuCategoryDto>> HandleAsync(SaveMenuCategoryCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        MenuCategory category;
        if (request.Id is { } id)
        {
            var existing = await db.MenuCategories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
            if (existing is null)
            {
                return MenuErrors.CategoryNotFound;
            }

            if (existing.IsArchived)
            {
                return MenuErrors.CategoryArchived;
            }

            category = existing;
        }
        else
        {
            var nextSort = await db.MenuCategories.Select(c => (int?)c.SortOrder).MaxAsync(cancellationToken) ?? -1;
            category = new MenuCategory { SortOrder = nextSort + 1 };
            db.MenuCategories.Add(category);
        }

        category.Name = request.Name.Trim();
        category.NameUz = string.IsNullOrWhiteSpace(request.NameUz) ? null : request.NameUz.Trim();
        category.SortOrder = request.SortOrder ?? category.SortOrder;
        category.IsActive = request.IsActive ?? category.IsActive;
        audit.Log(request.Id is null ? "menu_category.created" : "menu_category.updated", nameof(MenuCategory), category.Id, request);
        await db.SaveChangesAsync(cancellationToken);

        var itemCount = await db.MenuItems.CountAsync(i => i.CategoryId == category.Id && !i.IsArchived, cancellationToken);
        return new MenuCategoryDto(category.Id, category.Name, category.NameUz, category.SortOrder, category.IsActive,
            category.IsArchived, itemCount);
    }
}

/// <summary>DELETE = archive (categories keep order history). Refused while non-archived items remain (409).</summary>
public sealed class ArchiveMenuCategoryHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveMenuCategoryCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveMenuCategoryCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var category = await db.MenuCategories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (category is null)
        {
            return MenuErrors.CategoryNotFound;
        }

        if (category.IsArchived)
        {
            return Unit.Value;
        }

        if (await db.MenuItems.AnyAsync(i => i.CategoryId == category.Id && !i.IsArchived, cancellationToken))
        {
            return MenuErrors.CategoryHasItems;
        }

        category.Archive(clock.UtcNow);
        audit.Log("menu_category.archived", nameof(MenuCategory), category.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

/// <summary>Sets SortOrder to the index in <c>ids</c>; every id must be a category of the organization (else 404).</summary>
public sealed class ReorderMenuCategoriesHandler(
    IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit, ListMenuCategoriesHandler list)
    : IHandler<ReorderMenuCategoriesCommand, IReadOnlyList<MenuCategoryDto>>
{
    public async Task<Result<IReadOnlyList<MenuCategoryDto>>> HandleAsync(ReorderMenuCategoriesCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var ids = request.Ids.ToList();
        var categories = await db.MenuCategories.Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, cancellationToken);
        if (categories.Count != ids.Count)
        {
            return MenuErrors.CategoryNotFound;
        }

        for (var index = 0; index < ids.Count; index++)
        {
            categories[ids[index]].SortOrder = index;
        }

        audit.Log("menu_category.reordered", nameof(MenuCategory), null, new { ids });
        await db.SaveChangesAsync(cancellationToken);
        return await list.HandleAsync(new ListMenuCategoriesQuery(), cancellationToken);
    }
}
