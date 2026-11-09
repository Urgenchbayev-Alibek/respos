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

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Title).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.Body).HasMaxLength(2000);
        builder.Property(e => e.Link).HasMaxLength(UrlLength);
        builder.HasIndex(e => new { e.OrganizationId, e.BranchId, e.CreatedAt });
        builder.HasIndex(e => e.UserId);
        builder.HasOne<RestaurantBranch>().WithMany()
            .HasForeignKey(e => e.BranchId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Reads).WithOne()
            .HasForeignKey(r => r.NotificationId).OnDelete(DeleteBehavior.Cascade);
    }
}
