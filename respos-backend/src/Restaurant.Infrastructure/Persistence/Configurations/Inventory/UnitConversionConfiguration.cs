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

internal sealed class UnitConversionConfiguration : IEntityTypeConfiguration<UnitConversion>
{
    public void Configure(EntityTypeBuilder<UnitConversion> builder)
    {
        builder.ToTable("unit_conversions");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Factor).HasPrecision(18, 6);
        builder.HasIndex(e => new { e.FromUnitId, e.ToUnitId }).IsUnique();
        builder.HasOne(e => e.FromUnit).WithMany()
            .HasForeignKey(e => e.FromUnitId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.ToUnit).WithMany()
            .HasForeignKey(e => e.ToUnitId).OnDelete(DeleteBehavior.Restrict);
    }
}
