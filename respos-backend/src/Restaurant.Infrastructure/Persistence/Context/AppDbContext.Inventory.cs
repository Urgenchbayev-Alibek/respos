using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Entities.Recipes;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Inventory module DbSets (implements IApplicationDbContext.Inventory.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<UnitOfMeasure> Units => Set<UnitOfMeasure>();
    public DbSet<UnitConversion> UnitConversions => Set<UnitConversion>();
    public DbSet<IngredientCategory> IngredientCategories => Set<IngredientCategory>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<StockBalance> StockBalances => Set<StockBalance>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<InventoryConsumption> InventoryConsumptions => Set<InventoryConsumption>();
    public DbSet<InventoryCount> InventoryCounts => Set<InventoryCount>();
    public DbSet<InventoryCountLine> InventoryCountLines => Set<InventoryCountLine>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
}
