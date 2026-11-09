using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Reservations;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Floor / reservations / menu / kitchen stations DbSets.</summary>
public partial interface IApplicationDbContext
{
    DbSet<DiningArea> DiningAreas { get; }
    DbSet<DiningTable> DiningTables { get; }
    DbSet<TableReservation> TableReservations { get; }

    DbSet<KitchenStation> KitchenStations { get; }
    DbSet<MenuCategory> MenuCategories { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<MenuItemVariant> MenuItemVariants { get; }
    DbSet<ModifierGroup> ModifierGroups { get; }
    DbSet<ModifierOption> ModifierOptions { get; }
    DbSet<MenuItemModifierGroup> MenuItemModifierGroups { get; }
    DbSet<MenuAvailability> MenuAvailabilities { get; }
}
