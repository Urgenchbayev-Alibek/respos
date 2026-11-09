using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Features.Inventory.Consumption;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Infrastructure.Context;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Inventory;

[Collection(ApiCollection.Name)]
public sealed class ConsumptionTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Order_paid_consumption_is_idempotent_and_uses_variant_recipe_first()
    {
        var setup = await ArrangeAsync();
        var order = await SeedPaidOrderAsync(setup, raiseEvents: false);

        await DispatchOrderPaidAsync(setup.Org, order);
        await DispatchOrderPaidAsync(setup.Org, order);

        var rice = await MovementsAsync(setup.Rice);
        var consumption = rice.Where(m => m.Type == StockMovementType.Consumption).ToList();
        consumption.Should().ContainSingle();
        consumption[0].Quantity.Should().Be(-0.4m); // 2 × 100 g (variant recipe) + 1 × 200 g (item recipe); cancelled/no-recipe skipped
        consumption[0].SourceType.Should().Be(StockMovementSource.Order);
        consumption[0].SourceId.Should().Be(order.Id);
        consumption[0].BalanceAfter.Should().Be(-0.1m); // sale may go negative even with AllowNegativeStock = false
        (await MovementsAsync(setup.Oil)).Should().ContainSingle(m => m.Quantity == -0.02m);
        (await BalanceAsync(setup.Org, setup.Rice)).Should().Be(-0.1m);

        await WithDbAsync(async (db, _) =>
        {
            (await db.InventoryConsumptions.IgnoreQueryFilters().CountAsync(c => c.OrderId == order.Id)).Should().Be(1);
            (await db.AuditLogs.AnyAsync(a => a.Action == "stock.negative_after_sale" && a.EntityId == setup.Rice.ToString())).Should().BeTrue();
        });
    }

    [Fact]
    public async Task Consumption_runs_inside_the_payment_unit_of_work()
    {
        var setup = await ArrangeAsync();
        var order = await SeedPaidOrderAsync(setup, raiseEvents: true);

        (await MovementsAsync(setup.Rice)).Should().ContainSingle(m => m.Type == StockMovementType.Consumption && m.SourceId == order.Id);

        await DispatchOrderPaidAsync(setup.Org, order);
        (await MovementsAsync(setup.Rice)).Count(m => m.Type == StockMovementType.Consumption).Should().Be(1);
    }

    private sealed record Setup(TestOrg Org, Guid Rice, Guid Oil, Guid MenuItemId, Guid VariantId, Guid NoRecipeItemId);

    private async Task<Setup> ArrangeAsync()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var rice = await SeedIngredientAsync(org, "Рис");
        var oil = await SeedIngredientAsync(org, "Масло", "l");
        var (menuItemId, variantId) = await SeedMenuItemAsync(org);
        var (noRecipeItemId, _) = await SeedMenuItemAsync(org, "Хлеб");
        var grams = await UnitIdAsync(org, "g");
        await SeedRecipeAsync(org, menuItemId, null, (rice, 200m, grams));
        await SeedRecipeAsync(org, menuItemId, variantId, (rice, 100m, grams), (oil, 10m, await UnitIdAsync(org, "ml")));
        await WithDbAsync(async (db, _) =>
        {
            foreach (var (ingredientId, quantity) in new[] { (rice, 0.3m), (oil, 1m) })
            {
                var balance = StockBalance.Create(org.OrganizationId, org.BranchId, ingredientId);
                var movement = new StockMovement
                {
                    OrganizationId = org.OrganizationId, BranchId = org.BranchId, IngredientId = ingredientId,
                    Type = StockMovementType.Receipt, SourceType = StockMovementSource.Manual, Quantity = quantity, CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                };
                balance.Apply(movement, allowNegative: false);
                db.AddRange(balance, movement);
            }

            await db.SaveChangesAsync();
        });
        return new Setup(org, rice, oil, menuItemId, variantId, noRecipeItemId);
    }

    private async Task<Order> SeedPaidOrderAsync(Setup setup, bool raiseEvents)
    {
        var now = DateTime.UtcNow;
        var order = Order.Create(setup.Org.OrganizationId, setup.Org.BranchId, OrderType.Takeaway, null, setup.Org.User.Id, 1,
            Random.Shared.Next(1, 100000), DateOnly.FromDateTime(now), null, now);
        order.AddItem(OrderItem.Create(setup.MenuItemId, "Плов", 30000m, 2m, setup.VariantId, "0.5"), OrderPricingSettings.None, null, now);
        order.AddItem(OrderItem.Create(setup.MenuItemId, "Плов", 50000m, 1m), OrderPricingSettings.None, null, now);
        order.AddItem(OrderItem.Create(setup.NoRecipeItemId, "Хлеб", 5000m, 3m), OrderPricingSettings.None, null, now);
        var cancelled = OrderItem.Create(setup.MenuItemId, "Плов", 50000m, 5m);
        order.AddItem(cancelled, OrderPricingSettings.None, null, now);
        cancelled.Cancel("ошибка");
        order.RecalculateTotals(OrderPricingSettings.None);
        order.RegisterPayment(order.Total, setup.Org.User.Id, now);
        if (!raiseEvents)
        {
            order.ClearDomainEvents();
        }

        await using var scope = Factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<RequestContext>().SetUser(setup.Org.User.Id, setup.Org.OrganizationId, false);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order;
    }

    private async Task DispatchOrderPaidAsync(TestOrg org, Order order)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<RequestContext>().SetUser(org.User.Id, org.OrganizationId, false);
        var handler = scope.ServiceProvider.GetServices<IDomainEventHandler<OrderPaidDomainEvent>>()
            .OfType<ConsumeIngredientsOnOrderPaidHandler>().Single();
        await handler.HandleAsync(new OrderPaidDomainEvent(order.Id, order.BranchId), default);
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().SaveChangesAsync();
    }
}
