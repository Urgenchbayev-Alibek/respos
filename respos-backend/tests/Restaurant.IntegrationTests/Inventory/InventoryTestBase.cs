using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Recipes;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Inventory;

/// <summary>Seeding helpers for inventory / recipes / procurement tests (all data created per test).</summary>
public abstract class InventoryTestBase(ApiFactory factory) : ApiTestBase(factory)
{
    protected async Task<Guid> UnitIdAsync(TestOrg org, string code)
    {
        Guid id = default;
        await WithDbAsync(async (db, _) =>
            id = await db.Units.IgnoreQueryFilters().Where(u => u.OrganizationId == org.OrganizationId && u.Code == code)
                .Select(u => u.Id).FirstAsync());
        return id;
    }

    protected async Task<Guid> SeedIngredientAsync(TestOrg org, string name, string baseUnit = "kg", decimal costPrice = 0m)
    {
        var unitId = await UnitIdAsync(org, baseUnit);
        var ingredient = new Ingredient { OrganizationId = org.OrganizationId, Name = name, BaseUnitId = unitId, CostPrice = costPrice };
        await WithDbAsync(async (db, _) =>
        {
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();
        });
        return ingredient.Id;
    }

    protected async Task<(Guid MenuItemId, Guid VariantId)> SeedMenuItemAsync(TestOrg org, string name = "Плов")
    {
        var category = new MenuCategory { OrganizationId = org.OrganizationId, Name = "Горячее " + Guid.NewGuid().ToString("N")[..6] };
        var item = new MenuItem { OrganizationId = org.OrganizationId, CategoryId = category.Id, Name = name, Price = 50000m };
        var variant = new MenuItemVariant { MenuItemId = item.Id, Name = "0.5", Price = 30000m };
        await WithDbAsync(async (db, _) =>
        {
            db.MenuCategories.Add(category);
            db.MenuItems.Add(item);
            db.MenuItemVariants.Add(variant);
            await db.SaveChangesAsync();
        });
        return (item.Id, variant.Id);
    }

    protected async Task SeedRecipeAsync(TestOrg org, Guid menuItemId, Guid? variantId, params (Guid IngredientId, decimal Quantity, Guid UnitId)[] lines)
    {
        var recipe = new Recipe
        {
            OrganizationId = org.OrganizationId,
            MenuItemId = menuItemId,
            VariantId = variantId,
            EffectiveFrom = DateTime.UtcNow,
            Ingredients = lines.Select(l => new RecipeIngredient { IngredientId = l.IngredientId, Quantity = l.Quantity, UnitId = l.UnitId }).ToList(),
        };
        await WithDbAsync(async (db, _) =>
        {
            db.Recipes.Add(recipe);
            await db.SaveChangesAsync();
        });
    }

    protected async Task SetAllowNegativeAsync(TestOrg org, bool allow)
    {
        await WithDbAsync(async (db, _) =>
        {
            var settings = await db.BranchSettings.IgnoreQueryFilters().FirstAsync(s => s.BranchId == org.BranchId);
            settings.AllowNegativeStock = allow;
            await db.SaveChangesAsync();
        });
    }

    protected async Task<decimal> BalanceAsync(TestOrg org, Guid ingredientId)
    {
        decimal quantity = 0m;
        await WithDbAsync(async (db, _) =>
            quantity = await db.StockBalances.IgnoreQueryFilters()
                .Where(b => b.BranchId == org.BranchId && b.IngredientId == ingredientId)
                .Select(b => b.Quantity).FirstOrDefaultAsync());
        return quantity;
    }

    protected async Task<List<StockMovement>> MovementsAsync(Guid ingredientId)
    {
        List<StockMovement> list = [];
        await WithDbAsync(async (db, _) =>
            list = await db.StockMovements.IgnoreQueryFilters().AsNoTracking()
                .Where(m => m.IngredientId == ingredientId).OrderBy(m => m.CreatedAt).ToListAsync());
        return list;
    }

    protected static Task<HttpResponseMessage> PostMovementAsync(
        HttpClient client, Guid ingredientId, string type, decimal quantity, Guid? unitId = null, decimal? unitCost = null) =>
        client.PostAsJsonAsync("/api/v1/stock/movements", new { ingredientId, type, quantity, unitId, unitCost, reason = "test" }, Json);
}
