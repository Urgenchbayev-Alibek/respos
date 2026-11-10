using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Entities.Recipes;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reports;

/// <summary>Recipes with unit conversion and waiter orders (discount, cancelled line, cancelled order) built through the domain.</summary>
public sealed class AnalyticsTestData(TestOrg org, TestMenu menu)
{
    private int _number = 100;

    /// <summary>Plov: 250 g rice (20 000 / kg) = 5 000 per portion; tea: 10 g leaves (500 000 / kg) = 5 000 per portion.</summary>
    public static async Task SeedRecipesAsync(AppDbContext db, TestOrg org, TestMenu menu)
    {
        var units = await db.Units.IgnoreQueryFilters().Where(u => u.OrganizationId == org.OrganizationId).ToDictionaryAsync(u => u.Code, u => u.Id);
        var rice = new Ingredient { OrganizationId = org.OrganizationId, Name = "Рис", BaseUnitId = units["kg"], CostPrice = 20_000m };
        var leaves = new Ingredient { OrganizationId = org.OrganizationId, Name = "Чай листовой", BaseUnitId = units["kg"], CostPrice = 500_000m };
        db.AddRange(rice, leaves, Recipe(org, menu.Plov, rice.Id, 250m, units["g"]), Recipe(org, menu.Tea, leaves.Id, 10m, units["g"]));
        await db.SaveChangesAsync();
    }

    public Order NewOrder(Guid waiterId, DateOnly businessDate, DateTime atUtc, params (MenuItem Item, decimal Quantity)[] lines)
    {
        var order = Order.Create(org.OrganizationId, org.BranchId, OrderType.Takeaway, null, waiterId, 2,
            ++_number, businessDate, null, atUtc);
        foreach (var (item, quantity) in lines)
        {
            order.AddItem(OrderItem.Create(item.Id, item.Name, item.Price, quantity), OrderPricingSettings.None, waiterId, atUtc);
        }

        return order;
    }

    public Payment Pay(AppDbContext db, Order order, DateTime atUtc)
    {
        order.RegisterPayment(order.Total, org.User.Id, atUtc);
        var payment = new Payment
        {
            OrganizationId = org.OrganizationId,
            BranchId = org.BranchId,
            OrderId = order.Id,
            CashShiftId = menu.ShiftId,
            Method = PaymentMethod.Cash,
            Amount = order.Total,
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = atUtc,
        };
        db.AddRange(order, payment);
        return payment;
    }

    private static Recipe Recipe(TestOrg org, MenuItem item, Guid ingredientId, decimal quantity, Guid unitId) => new()
    {
        OrganizationId = org.OrganizationId,
        MenuItemId = item.Id,
        EffectiveFrom = DateTime.UtcNow,
        Ingredients = [new RecipeIngredient { IngredientId = ingredientId, Quantity = quantity, UnitId = unitId }],
    };
}
