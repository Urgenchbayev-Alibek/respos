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

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasIndex(e => e.FamilyId);
        builder.HasIndex(e => e.UserId);
        builder.Property(e => e.CreatedByIp).HasMaxLength(CodeLength);
        builder.HasOne(e => e.User).WithMany()
            .HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Organization>().WithMany()
            .HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Restrict);
    }
}
