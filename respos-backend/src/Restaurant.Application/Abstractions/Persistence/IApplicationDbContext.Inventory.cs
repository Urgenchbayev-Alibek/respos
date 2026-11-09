using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Entities.Recipes;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Inventory / recipes / procurement DbSets.</summary>
public partial interface IApplicationDbContext
{
    DbSet<UnitOfMeasure> Units { get; }
    DbSet<UnitConversion> UnitConversions { get; }
    DbSet<IngredientCategory> IngredientCategories { get; }
    DbSet<Ingredient> Ingredients { get; }
    DbSet<StockBalance> StockBalances { get; }
    DbSet<StockMovement> StockMovements { get; }
    DbSet<InventoryConsumption> InventoryConsumptions { get; }
    DbSet<InventoryCount> InventoryCounts { get; }
    DbSet<InventoryCountLine> InventoryCountLines { get; }

    DbSet<Recipe> Recipes { get; }
    DbSet<RecipeIngredient> RecipeIngredients { get; }

    DbSet<Supplier> Suppliers { get; }
    DbSet<PurchaseOrder> PurchaseOrders { get; }
    DbSet<PurchaseOrderItem> PurchaseOrderItems { get; }
}
