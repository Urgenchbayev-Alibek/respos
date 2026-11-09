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

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Code).HasMaxLength(CodeLength).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.HasIndex(e => new { e.OrganizationId, e.Code }).IsUnique();
        builder.HasMany(e => e.Permissions).WithOne(p => p.Role)
            .HasForeignKey(p => p.RoleId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.UserRoles).WithOne(ur => ur.Role)
            .HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Restrict);
    }
}
