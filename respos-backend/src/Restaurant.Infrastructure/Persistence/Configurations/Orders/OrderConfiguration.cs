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

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.HasIndex(e => new { e.BranchId, e.BusinessDate, e.Number }).IsUnique();
        builder.HasIndex(e => new { e.BranchId, e.Status });
        builder.HasIndex(e => new { e.BranchId, e.OpenedAt });
        builder.HasIndex(e => e.TableId);
        builder.HasIndex(e => e.WaiterId);
        builder.Property(e => e.Comment).HasMaxLength(CommentLength);
        builder.Property(e => e.CancelReason).HasMaxLength(ReasonLength);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasOne<DiningTable>().WithMany()
            .HasForeignKey(e => e.TableId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany()
            .HasForeignKey(e => e.WaiterId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Items).WithOne()
            .HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.History).WithOne()
            .HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}
