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

internal sealed class DemoRequestConfiguration : IEntityTypeConfiguration<DemoRequest>
{
    public void Configure(EntityTypeBuilder<DemoRequest> builder)
    {
        builder.ToTable("demo_requests");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(PhoneLength).IsRequired();
        builder.Property(e => e.Email).HasMaxLength(EmailLength);
        builder.Property(e => e.RestaurantName).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.City).HasMaxLength(100);
        builder.Property(e => e.Message).HasMaxLength(2000);
        builder.Property(e => e.IpAddress).HasMaxLength(CodeLength);
        builder.HasIndex(e => new { e.Status, e.CreatedAt });
    }
}
