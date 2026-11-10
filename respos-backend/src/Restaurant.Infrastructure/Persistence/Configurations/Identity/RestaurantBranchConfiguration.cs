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

internal sealed class RestaurantBranchConfiguration : IEntityTypeConfiguration<RestaurantBranch>
{
    public void Configure(EntityTypeBuilder<RestaurantBranch> builder)
    {
        builder.ToTable("branches");
        builder.HasKey(e => e.Id);
        builder.HasTenant(withForeignKey: false);
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.Address).HasMaxLength(ReasonLength);
        builder.Property(e => e.Phone).HasMaxLength(PhoneLength);
        builder.Property(e => e.Timezone).HasMaxLength(CodeLength).IsRequired();
        builder.Property(e => e.Slug).HasMaxLength(BranchSlug.MaxLength);
        builder.HasIndex(e => e.Slug).IsUnique();
        builder.HasOne(e => e.Settings).WithOne(s => s.Branch)
            .HasForeignKey<BranchSettings>(s => s.BranchId).OnDelete(DeleteBehavior.Cascade);
    }
}
