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

internal sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("menu_items");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.NameUz).HasMaxLength(NameLength);
        builder.Property(e => e.Description).HasMaxLength(2000);
        builder.Property(e => e.PhotoUrl).HasMaxLength(UrlLength);
        builder.Property(e => e.Sku).HasMaxLength(CodeLength);
        builder.HasIndex(e => new { e.OrganizationId, e.CategoryId });
        builder.HasOne<KitchenStation>().WithMany()
            .HasForeignKey(e => e.KitchenStationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Variants).WithOne(v => v.MenuItem)
            .HasForeignKey(v => v.MenuItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.ModifierGroups).WithOne(g => g.MenuItem)
            .HasForeignKey(g => g.MenuItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.Availability).WithOne(a => a.MenuItem)
            .HasForeignKey(a => a.MenuItemId).OnDelete(DeleteBehavior.Cascade);
    }
}
