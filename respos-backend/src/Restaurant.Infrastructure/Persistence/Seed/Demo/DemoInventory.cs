using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Enums;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>Ingredients with initial balances (each via a receipt movement), two categories, two suppliers.</summary>
internal static class DemoInventory
{
    private const string InitialReason = "Начальный остаток (демо)";

    private sealed record IngredientSpec(string Key, string Name, string Unit, decimal Cost, decimal Quantity, decimal Min, bool Drink = false);

    private static readonly IngredientSpec[] Ingredients =
    [
        new("rice", "Рис девзира", "kg", 28000m, 50m, 10m),
        new("carrot", "Морковь жёлтая", "kg", 6000m, 40m, 10m),
        new("lamb", "Баранина", "kg", 110000m, 25m, 8m),
        new("beef", "Говядина", "kg", 95000m, 20m, 5m),
        new("chicken", "Курица", "kg", 38000m, 15m, 5m),
        new("onion", "Лук репчатый", "kg", 4000m, 30m, 5m),
        new("flour", "Мука", "kg", 7000m, 40m, 10m),
        new("oil", "Масло хлопковое", "l", 25000m, 20m, 5m),
        new("chickpea", "Нут", "kg", 18000m, 3m, 5m),
        new("tomato", "Помидоры", "kg", 15000m, 12m, 3m),
        new("cucumber", "Огурцы", "kg", 12000m, 2m, 3m),
        new("pepper", "Перец болгарский", "kg", 20000m, 8m, 2m),
        new("sugar", "Сахар", "kg", 13000m, 15m, 3m),
        new("tea_green", "Чай зелёный", "g", 150m, 2000m, 500m, Drink: true),
        new("tea_black", "Чай чёрный", "g", 140m, 2000m, 500m, Drink: true),
        new("cola", "Кока-Кола 0.5 л", "pcs", 7000m, 48m, 12m, Drink: true),
    ];

    public static IReadOnlyDictionary<string, Ingredient> Add(DemoContext context)
    {
        var food = Category(context, "Продукты");
        var drinks = Category(context, "Напитки и чай");
        var result = new Dictionary<string, Ingredient>(StringComparer.Ordinal);
        foreach (var spec in Ingredients)
        {
            var ingredient = new Ingredient
            {
                OrganizationId = context.OrganizationId,
                CategoryId = spec.Drink ? drinks.Id : food.Id,
                Name = spec.Name,
                Sku = spec.Key.ToUpperInvariant(),
                BaseUnitId = context.Units[spec.Unit].Id,
                CostPrice = spec.Cost,
            };
            context.Db.Ingredients.Add(ingredient);
            AddInitialBalance(context, ingredient, spec);
            result[spec.Key] = ingredient;
        }

        AddSuppliers(context);
        return result;
    }

    private static void AddInitialBalance(DemoContext context, Ingredient ingredient, IngredientSpec spec)
    {
        var balance = StockBalance.Create(context.OrganizationId, context.BranchId, ingredient.Id, spec.Min);
        var movement = new StockMovement
        {
            OrganizationId = context.OrganizationId,
            BranchId = context.BranchId,
            IngredientId = ingredient.Id,
            Type = StockMovementType.Receipt,
            Quantity = spec.Quantity,
            UnitCost = spec.Cost,
            SourceType = StockMovementSource.Manual,
            Reason = InitialReason,
            CreatedAt = context.Now,
        };
        balance.Apply(movement, allowNegative: false);
        context.Db.StockBalances.Add(balance);
        context.Db.StockMovements.Add(movement);
    }

    private static IngredientCategory Category(DemoContext context, string name)
    {
        var category = new IngredientCategory { OrganizationId = context.OrganizationId, Name = name };
        context.Db.IngredientCategories.Add(category);
        return category;
    }

    private static void AddSuppliers(DemoContext context)
    {
        context.Db.Suppliers.AddRange(
            new Supplier
            {
                OrganizationId = context.OrganizationId,
                Name = "ООО «Агро Ташкент»",
                ContactPerson = "Шахзод Мирзаев",
                Phone = "+998 90 123-45-67",
                Email = "agro@example.uz",
                Address = "г. Ташкент, рынок Чорсу (демо)",
                Inn = "300000001",
                Notes = "Овощи, рис, бакалея (демо)",
            },
            new Supplier
            {
                OrganizationId = context.OrganizationId,
                Name = "ИП «Мясной двор»",
                ContactPerson = "Фарход Исмоилов",
                Phone = "+998 93 765-43-21",
                Address = "Ташкентская обл. (демо)",
                Inn = "400000002",
                Notes = "Баранина, говядина, курица (демо)",
            });
    }
}
