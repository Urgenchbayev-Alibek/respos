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

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("order_items");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.NameSnapshot).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.VariantNameSnapshot).HasMaxLength(NameLength);
        builder.Property(e => e.Comment).HasMaxLength(ReasonLength);
        builder.Property(e => e.CancelReason).HasMaxLength(ReasonLength);
        builder.Property(e => e.Quantity).IsQuantity();
        builder.HasIndex(e => e.MenuItemId);
        builder.HasOne<MenuItem>().WithMany()
            .HasForeignKey(e => e.MenuItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MenuItemVariant>().WithMany()
            .HasForeignKey(e => e.VariantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<KitchenStation>().WithMany()
            .HasForeignKey(e => e.KitchenStationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Modifiers).WithOne()
            .HasForeignKey(m => m.OrderItemId).OnDelete(DeleteBehavior.Cascade);
    }
}
