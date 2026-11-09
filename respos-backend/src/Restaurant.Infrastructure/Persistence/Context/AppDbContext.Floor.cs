using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Reservations;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Floor module DbSets (implements IApplicationDbContext.Floor.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<DiningArea> DiningAreas => Set<DiningArea>();
    public DbSet<DiningTable> DiningTables => Set<DiningTable>();
    public DbSet<TableReservation> TableReservations => Set<TableReservation>();
    public DbSet<KitchenStation> KitchenStations => Set<KitchenStation>();
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<MenuItemVariant> MenuItemVariants => Set<MenuItemVariant>();
    public DbSet<ModifierGroup> ModifierGroups => Set<ModifierGroup>();
    public DbSet<ModifierOption> ModifierOptions => Set<ModifierOption>();
    public DbSet<MenuItemModifierGroup> MenuItemModifierGroups => Set<MenuItemModifierGroup>();
    public DbSet<MenuAvailability> MenuAvailabilities => Set<MenuAvailability>();
}
