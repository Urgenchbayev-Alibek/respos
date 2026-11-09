using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Recipes;

namespace Restaurant.Application.Features.Recipes.Common;

public sealed record RecipeIngredientDto(Guid IngredientId, string IngredientName, decimal Quantity, Guid UnitId, string UnitCode);

public sealed record RecipeDto(
    Guid Id,
    Guid MenuItemId,
    string MenuItemName,
    Guid? VariantId,
    int Version,
    DateTime EffectiveFrom,
    bool IsActive,
    IReadOnlyList<RecipeIngredientDto> Ingredients,
    decimal EstimatedCost);

/// <summary>Loads recipes with ingredients and computes <c>estimatedCost = Σ CostPrice × quantity in base unit</c>.</summary>
[ScopedService]
public sealed class RecipeReader(IApplicationDbContext db, UnitConverter converter)
{
    public async Task<IReadOnlyList<RecipeDto>> ListAsync(Guid organizationId, IQueryable<Recipe> query, CancellationToken cancellationToken)
    {
        var recipes = await query.AsNoTracking()
            .Include(r => r.Ingredients).ThenInclude(i => i.Ingredient)
            .Include(r => r.Ingredients).ThenInclude(i => i.Unit)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        var menuItemIds = recipes.Select(r => r.MenuItemId).Distinct().ToList();
        var names = await db.MenuItems.AsNoTracking().Where(m => menuItemIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, m => m.Name, cancellationToken);

        var result = new List<RecipeDto>(recipes.Count);
        foreach (var recipe in recipes)
        {
            result.Add(await ToDtoAsync(organizationId, recipe, names.GetValueOrDefault(recipe.MenuItemId, string.Empty), cancellationToken));
        }

        return result;
    }

    public async Task<RecipeDto?> GetAsync(Guid organizationId, Guid id, CancellationToken cancellationToken) =>
        (await ListAsync(organizationId, db.Recipes.Where(r => r.Id == id), cancellationToken)).FirstOrDefault();

    private async Task<RecipeDto> ToDtoAsync(Guid organizationId, Recipe recipe, string menuItemName, CancellationToken cancellationToken)
    {
        var cost = 0m;
        var lines = new List<RecipeIngredientDto>();
        foreach (var line in recipe.Ingredients.OrderBy(i => i.Ingredient?.Name))
        {
            lines.Add(new RecipeIngredientDto(line.IngredientId, line.Ingredient?.Name ?? string.Empty, line.Quantity, line.UnitId, line.Unit?.Code ?? string.Empty));
            if (line.Ingredient is { } ingredient
                && await converter.TryGetFactorAsync(organizationId, line.UnitId, ingredient.BaseUnitId, cancellationToken) is { } factor)
            {
                cost += ingredient.CostPrice * line.Quantity * factor;
            }
        }

        return new RecipeDto(recipe.Id, recipe.MenuItemId, menuItemName, recipe.VariantId, recipe.Version,
            recipe.EffectiveFrom, recipe.IsActive, lines, Money.Round(cost));
    }
}
