using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Notifications;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Entities.Recipes;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Entities.Saas;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class RecipeConfiguration : IEntityTypeConfiguration<Recipe>
{
    public void Configure(EntityTypeBuilder<Recipe> builder)
    {
        builder.ToTable("recipes");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.HasIndex(e => new { e.MenuItemId, e.VariantId, e.Version }).IsUnique();

        // Only one active version per (menu item, variant). Two filtered indexes because NULLs are distinct in Postgres.
        builder.HasIndex(e => new { e.MenuItemId, e.VariantId }).IsUnique()
            .HasFilter("is_active = true AND variant_id IS NOT NULL")
            .HasDatabaseName("ux_recipes_active_variant");
        builder.HasIndex(e => e.MenuItemId).IsUnique()
            .HasFilter("is_active = true AND variant_id IS NULL")
            .HasDatabaseName("ux_recipes_active_no_variant");
        builder.HasOne<MenuItem>().WithMany()
            .HasForeignKey(e => e.MenuItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MenuItemVariant>().WithMany()
            .HasForeignKey(e => e.VariantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Ingredients).WithOne()
            .HasForeignKey(i => i.RecipeId).OnDelete(DeleteBehavior.Cascade);
    }
}
