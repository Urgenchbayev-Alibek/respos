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

internal sealed class DiningTableConfiguration : IEntityTypeConfiguration<DiningTable>
{
    public void Configure(EntityTypeBuilder<DiningTable> builder)
    {
        builder.ToTable("dining_tables");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Number).HasMaxLength(20).IsRequired();
        builder.HasIndex(e => new { e.BranchId, e.Number }).IsUnique().HasFilter("is_archived = false");
        builder.HasIndex(e => new { e.BranchId, e.Status });
        builder.Property(e => e.PosX).HasPrecision(9, 2);
        builder.Property(e => e.PosY).HasPrecision(9, 2);
    }
}
