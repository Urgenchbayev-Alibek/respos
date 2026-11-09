using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Recipes;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>Version-1 active recipes per portion (quantities in g/ml/pcs; converted to base units on consumption).</summary>
internal static class DemoRecipes
{
    private static readonly (string Item, string? Variant, (string Ingredient, decimal Qty, string Unit)[] Lines)[] Recipes =
    [
        ("plov", null, [("rice", 150m, "g"), ("carrot", 120m, "g"), ("lamb", 100m, "g"), ("onion", 30m, "g"), ("oil", 40m, "ml"), ("chickpea", 15m, "g")]),
        ("lagman", null, [("flour", 120m, "g"), ("beef", 90m, "g"), ("pepper", 40m, "g"), ("tomato", 40m, "g"), ("onion", 20m, "g"), ("oil", 20m, "ml")]),
        ("shashlik", "Баранина", [("lamb", 150m, "g"), ("onion", 30m, "g")]),
        ("shashlik", "Говядина", [("beef", 150m, "g"), ("onion", 30m, "g")]),
        ("shashlik", "Курица", [("chicken", 150m, "g"), ("onion", 30m, "g")]),
        ("samsa", null, [("flour", 80m, "g"), ("lamb", 60m, "g"), ("onion", 30m, "g"), ("oil", 10m, "ml")]),
        ("manti", null, [("flour", 70m, "g"), ("lamb", 90m, "g"), ("onion", 50m, "g"), ("oil", 10m, "ml")]),
        ("achichuk", null, [("tomato", 120m, "g"), ("cucumber", 80m, "g"), ("onion", 20m, "g")]),
        ("tea_green", null, [("tea_green", 5m, "g")]),
        ("tea_black", null, [("tea_black", 5m, "g"), ("sugar", 10m, "g")]),
        ("cola", null, [("cola", 1m, "pcs")]),
    ];

    public static void Add(DemoContext context, IReadOnlyDictionary<string, MenuItem> menu, IReadOnlyDictionary<string, Ingredient> ingredients)
    {
        foreach (var (itemKey, variantName, lines) in Recipes)
        {
            var item = menu[itemKey];
            var recipe = new Recipe
            {
                OrganizationId = context.OrganizationId,
                MenuItemId = item.Id,
                VariantId = variantName is null ? null : item.Variants.Single(v => v.Name == variantName).Id,
                Version = 1,
                EffectiveFrom = context.Now,
                IsActive = true,
            };
            foreach (var (ingredientKey, quantity, unit) in lines)
            {
                recipe.Ingredients.Add(new RecipeIngredient
                {
                    RecipeId = recipe.Id,
                    IngredientId = ingredients[ingredientKey].Id,
                    Quantity = quantity,
                    UnitId = context.Units[unit].Id,
                });
            }

            context.Db.Recipes.Add(recipe);
        }
    }
}
