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

internal sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("suppliers");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.ContactPerson).HasMaxLength(NameLength);
        builder.Property(e => e.Phone).HasMaxLength(PhoneLength);
        builder.Property(e => e.Email).HasMaxLength(EmailLength);
        builder.Property(e => e.Address).HasMaxLength(ReasonLength);
        builder.Property(e => e.Inn).HasMaxLength(32);
        builder.Property(e => e.Notes).HasMaxLength(2000);
    }
}
