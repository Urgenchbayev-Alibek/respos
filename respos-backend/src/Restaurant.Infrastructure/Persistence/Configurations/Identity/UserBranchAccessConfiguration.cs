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

internal sealed class UserBranchAccessConfiguration : IEntityTypeConfiguration<UserBranchAccess>
{
    public void Configure(EntityTypeBuilder<UserBranchAccess> builder)
    {
        builder.ToTable("user_branch_accesses");
        builder.HasKey(e => new { e.UserId, e.BranchId });
        builder.HasTenant();
        builder.HasIndex(e => e.BranchId);
        builder.HasOne(e => e.User).WithMany(u => u.BranchAccesses)
            .HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.Branch).WithMany()
            .HasForeignKey(e => e.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}
