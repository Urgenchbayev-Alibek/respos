using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Recipes;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;

namespace Restaurant.Application.Features.Inventory.Consumption;

/// <summary>
/// ADR-0006: on full payment, writes off recipe ingredients (active version: variant-specific, else item-level)
/// × item quantity as <c>consumption</c> movements, inside the payment's unit of work.
/// Idempotent: one <see cref="InventoryConsumption"/> per order (unique OrderId) — repeated events do nothing.
/// Sale consumption may go negative (Q8) → audited; StockLow is raised by the balance.
/// </summary>
public sealed class ConsumeIngredientsOnOrderPaidHandler(
    IApplicationDbContext db,
    StockLedger ledger,
    UnitConverter converter,
    IAuditLogger audit,
    IClock clock,
    ILogger<ConsumeIngredientsOnOrderPaidHandler> logger) : IDomainEventHandler<OrderPaidDomainEvent>
{
    public async Task HandleAsync(OrderPaidDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        if (db.InventoryConsumptions.Local.Any(c => c.OrderId == domainEvent.OrderId)
            || await db.InventoryConsumptions.IgnoreQueryFilters().AnyAsync(c => c.OrderId == domainEvent.OrderId, cancellationToken))
        {
            return;
        }

        // DB first (Include fills Items on the tracked instance); fall back to an order still pending insert in this
        // unit of work, since events dispatch before commit.
        var order = await db.Orders.IgnoreQueryFilters().Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == domainEvent.OrderId, cancellationToken)
            ?? db.Orders.Local.FirstOrDefault(o => o.Id == domainEvent.OrderId);
        if (order is null)
        {
            logger.LogWarning("Paid order {OrderId} not found; ingredient consumption skipped", domainEvent.OrderId);
            return;
        }

        var items = order.Items.Where(i => i.Status != OrderItemStatus.Cancelled).ToList();
        var recipes = await LoadActiveRecipesAsync(order.OrganizationId, items, cancellationToken);
        var totals = new Dictionary<Guid, decimal>();
        var usedRecipes = new Dictionary<Guid, Recipe>();
        foreach (var item in items)
        {
            var recipe = recipes.FirstOrDefault(r => r.MenuItemId == item.MenuItemId && item.VariantId != null && r.VariantId == item.VariantId)
                ?? recipes.FirstOrDefault(r => r.MenuItemId == item.MenuItemId && r.VariantId == null);
            if (recipe is null)
            {
                logger.LogWarning("Order {OrderId}: menu item {MenuItemId} has no active recipe; not consumed", order.Id, item.MenuItemId);
                continue;
            }

            usedRecipes[recipe.Id] = recipe;
            await AddRecipeQuantitiesAsync(order, recipe, item.Quantity, totals, cancellationToken);
        }

        foreach (var (ingredientId, quantity) in totals.Where(t => t.Value != 0))
        {
            var movement = await ledger.ApplyAsync(
                new StockChange(order.OrganizationId, order.BranchId, ingredientId, StockMovementType.Consumption, -quantity, StockMovementSource.Order)
                {
                    SourceId = order.Id,
                    Reason = $"Order #{order.Number}",
                },
                allowNegative: true,
                cancellationToken);
            if (movement.BalanceAfter < 0)
            {
                audit.Log(new AuditEntry("stock.negative_after_sale", nameof(Ingredient), ingredientId.ToString(),
                    new { orderId = order.Id, balanceAfter = movement.BalanceAfter })
                {
                    OrganizationId = order.OrganizationId,
                    BranchId = order.BranchId,
                });
            }
        }

        db.InventoryConsumptions.Add(new InventoryConsumption
        {
            OrganizationId = order.OrganizationId,
            BranchId = order.BranchId,
            OrderId = order.Id,
            RecipeVersionsJson = JsonSerializer.Serialize(usedRecipes.Values.Select(r =>
                new { recipeId = r.Id, menuItemId = r.MenuItemId, variantId = r.VariantId, version = r.Version })),
            CreatedAt = clock.UtcNow,
        });
    }

    private async Task<List<Recipe>> LoadActiveRecipesAsync(Guid organizationId, List<OrderItem> items, CancellationToken cancellationToken)
    {
        var menuItemIds = items.Select(i => i.MenuItemId).Distinct().ToList();
        return await db.Recipes.IgnoreQueryFilters().AsNoTracking()
            .Include(r => r.Ingredients).ThenInclude(i => i.Ingredient)
            .Where(r => r.OrganizationId == organizationId && r.IsActive && menuItemIds.Contains(r.MenuItemId))
            .ToListAsync(cancellationToken);
    }

    private async Task AddRecipeQuantitiesAsync(
        Order order, Recipe recipe, decimal itemQuantity, Dictionary<Guid, decimal> totals, CancellationToken cancellationToken)
    {
        foreach (var line in recipe.Ingredients)
        {
            if (line.Ingredient is null)
            {
                continue;
            }

            var factor = await converter.TryGetFactorAsync(order.OrganizationId, line.UnitId, line.Ingredient.BaseUnitId, cancellationToken);
            if (factor is null)
            {
                logger.LogWarning("Order {OrderId}: recipe {RecipeId} ingredient {IngredientId} has no unit conversion; not consumed",
                    order.Id, recipe.Id, line.IngredientId);
                continue;
            }

            var quantity = UnitConverter.RoundQuantity(line.Quantity * factor.Value * itemQuantity);
            totals[line.IngredientId] = totals.GetValueOrDefault(line.IngredientId) + quantity;
        }
    }
}
