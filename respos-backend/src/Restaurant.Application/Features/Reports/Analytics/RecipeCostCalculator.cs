using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>Cost of one portion by the active recipe; <c>HasMissingConversions</c> = some line had no unit conversion (counted as 0).</summary>
public sealed record RecipeCost(Guid RecipeId, decimal Cost, bool HasMissingConversions);

/// <summary>
/// Current recipe cost per portion: Σ line.quantity × factor(line unit → ingredient base unit) × ingredient.CostPrice
/// (last purchase price per base unit), rounded to 2 decimals. Recipe choice mirrors consumption (ADR-0006):
/// the active variant-specific recipe, else the active item-level one. Menu-sized data, loaded once per scope.
/// </summary>
[ScopedService]
public sealed class RecipeCostCalculator(IApplicationDbContext db, ITenantContext tenant, UnitConverter converter)
{
    private Dictionary<(Guid MenuItemId, Guid? VariantId), RecipeCost>? _costs;

    /// <summary>Cost for a sold (menu item, variant) pair, or <c>null</c> when there is no active recipe.</summary>
    public async Task<RecipeCost?> FindAsync(Guid menuItemId, Guid? variantId, CancellationToken ct)
    {
        var costs = await LoadAsync(ct);
        if (variantId is not null && costs.TryGetValue((menuItemId, variantId), out var specific))
        {
            return specific;
        }

        return costs.GetValueOrDefault((menuItemId, null));
    }

    public static decimal LineCost(decimal quantity, decimal factorToBase, decimal costPricePerBase) =>
        quantity * factorToBase * costPricePerBase;

    private async Task<Dictionary<(Guid, Guid?), RecipeCost>> LoadAsync(CancellationToken ct)
    {
        if (_costs is not null)
        {
            return _costs;
        }

        var organizationId = tenant.RequireOrganizationId();
        var lines = await db.Recipes.AsNoTracking()
            .Where(r => r.IsActive)
            .SelectMany(r => r.Ingredients.Select(i => new
            {
                RecipeId = r.Id,
                r.MenuItemId,
                r.VariantId,
                i.Quantity,
                i.UnitId,
                BaseUnitId = (Guid?)i.Ingredient!.BaseUnitId,
                CostPrice = (decimal?)i.Ingredient.CostPrice,
            }))
            .ToListAsync(ct);
        var recipeKeys = await db.Recipes.AsNoTracking().Where(r => r.IsActive)
            .Select(r => new { r.Id, r.MenuItemId, r.VariantId })
            .ToListAsync(ct);

        var result = new Dictionary<(Guid, Guid?), RecipeCost>();
        foreach (var recipe in recipeKeys)
        {
            var cost = 0m;
            var missing = false;
            foreach (var line in lines.Where(l => l.RecipeId == recipe.Id))
            {
                var factor = line.BaseUnitId is { } baseUnit
                    ? await converter.TryGetFactorAsync(organizationId, line.UnitId, baseUnit, ct)
                    : null;
                if (factor is null)
                {
                    missing = true;
                    continue;
                }

                cost += LineCost(line.Quantity, factor.Value, line.CostPrice ?? 0m);
            }

            result[(recipe.MenuItemId, recipe.VariantId)] = new RecipeCost(recipe.Id, Money.Round(cost), missing);
        }

        _costs = result;
        return result;
    }
}
