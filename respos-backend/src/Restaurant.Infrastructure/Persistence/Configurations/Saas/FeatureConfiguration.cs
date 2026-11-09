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

internal sealed class FeatureConfiguration : IEntityTypeConfiguration<Feature>
{
    public void Configure(EntityTypeBuilder<Feature> builder)
    {
        builder.ToTable("features");
        builder.HasKey(e => e.Code);
        builder.Property(e => e.Code).HasMaxLength(CodeLength);
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
    }
}
