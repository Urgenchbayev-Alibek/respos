using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Application.Features.Recipes.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Recipes;

namespace Restaurant.Application.Features.Recipes;

public sealed class ListRecipesHandler(IApplicationDbContext db, ITenantContext tenant, RecipeReader reader)
    : IHandler<ListRecipesQuery, IReadOnlyList<RecipeDto>>
{
    public async Task<Result<IReadOnlyList<RecipeDto>>> HandleAsync(ListRecipesQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var query = db.Recipes.Where(r => r.IsActive);
        if (request.MenuItemId is { } menuItemId)
        {
            query = query.Where(r => r.MenuItemId == menuItemId);
        }

        var list = await reader.ListAsync(orgId, query, cancellationToken);
        return list.OrderBy(r => r.MenuItemName).ThenBy(r => r.VariantId).ToList();
    }
}

public sealed class RecipeHistoryHandler(IApplicationDbContext db, ITenantContext tenant, RecipeReader reader)
    : IHandler<RecipeHistoryQuery, IReadOnlyList<RecipeDto>>
{
    public async Task<Result<IReadOnlyList<RecipeDto>>> HandleAsync(RecipeHistoryQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var list = await reader.ListAsync(orgId, db.Recipes.Where(r => r.MenuItemId == request.MenuItemId), cancellationToken);
        return list.OrderBy(r => r.VariantId).ThenByDescending(r => r.Version).ToList();
    }
}

public sealed class GetRecipeHandler(ITenantContext tenant, RecipeReader reader) : IHandler<GetRecipeQuery, RecipeDto>
{
    public async Task<Result<RecipeDto>> HandleAsync(GetRecipeQuery request, CancellationToken cancellationToken) =>
        await reader.GetAsync(tenant.RequireOrganizationId(), request.Id, cancellationToken) is { } dto ? dto : RecipeErrors.NotFound;
}

/// <summary>
/// Saves a recipe as a NEW version (Version = last + 1, EffectiveFrom = now) and deactivates the previous active one;
/// history rows are kept. Two saves in one transaction so the "one active version" unique index is never violated.
/// </summary>
public sealed class SaveRecipeHandler(
    IApplicationDbContext db, ITenantContext tenant, UnitConverter converter, RecipeReader reader, IClock clock, IAuditLogger audit)
    : IHandler<SaveRecipeCommand, RecipeDto>
{
    public async Task<Result<RecipeDto>> HandleAsync(SaveRecipeCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var validation = await ValidateAsync(orgId, request, cancellationToken);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        var recipeId = await db.ExecuteInTransactionAsync(async ct =>
        {
            var versions = await db.Recipes
                .Where(r => r.MenuItemId == request.MenuItemId && r.VariantId == request.VariantId)
                .ToListAsync(ct);
            foreach (var previous in versions.Where(r => r.IsActive))
            {
                previous.IsActive = false;
            }

            await db.SaveChangesAsync(ct);
            var recipe = new Recipe
            {
                OrganizationId = orgId,
                MenuItemId = request.MenuItemId,
                VariantId = request.VariantId,
                Version = versions.Count == 0 ? 1 : versions.Max(r => r.Version) + 1,
                EffectiveFrom = clock.UtcNow,
                IsActive = true,
                Ingredients = request.Ingredients
                    .Select(l => new RecipeIngredient { IngredientId = l.IngredientId, Quantity = l.Quantity, UnitId = l.UnitId })
                    .ToList(),
            };
            db.Recipes.Add(recipe);
            audit.Log("recipe.version_created", nameof(Recipe), recipe.Id, new
            {
                recipe.MenuItemId,
                recipe.VariantId,
                recipe.Version,
                ingredients = request.Ingredients,
            });
            await db.SaveChangesAsync(ct);
            return recipe.Id;
        }, cancellationToken);

        return (await reader.GetAsync(orgId, recipeId, cancellationToken))!;
    }

    private async Task<Result> ValidateAsync(Guid orgId, SaveRecipeCommand request, CancellationToken cancellationToken)
    {
        if (!await db.MenuItems.AnyAsync(m => m.Id == request.MenuItemId, cancellationToken))
        {
            return RecipeErrors.MenuItemNotFound;
        }

        if (request.VariantId is { } variantId
            && !await db.MenuItemVariants.AnyAsync(v => v.Id == variantId && v.MenuItemId == request.MenuItemId, cancellationToken))
        {
            return RecipeErrors.InvalidVariant;
        }

        var ids = request.Ingredients.Select(l => l.IngredientId).ToList();
        var ingredients = await db.Ingredients.AsNoTracking().Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken);
        var unitIds = request.Ingredients.Select(l => l.UnitId).Distinct().ToList();
        if (await db.Units.CountAsync(u => unitIds.Contains(u.Id), cancellationToken) != unitIds.Count)
        {
            return InventoryErrors.UnitNotFound;
        }

        foreach (var line in request.Ingredients)
        {
            if (!ingredients.TryGetValue(line.IngredientId, out var ingredient))
            {
                return InventoryErrors.IngredientNotFound;
            }

            if (ingredient.IsArchived)
            {
                return InventoryErrors.IngredientArchived;
            }

            if (await converter.TryGetFactorAsync(orgId, line.UnitId, ingredient.BaseUnitId, cancellationToken) is null)
            {
                return InventoryErrors.ConversionMissing;
            }
        }

        return Result.Success();
    }
}
