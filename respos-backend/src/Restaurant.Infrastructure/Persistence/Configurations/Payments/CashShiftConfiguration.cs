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

internal sealed class CashShiftConfiguration : IEntityTypeConfiguration<CashShift>
{
    public void Configure(EntityTypeBuilder<CashShift> builder)
    {
        builder.ToTable("cash_shifts");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Comment).HasMaxLength(CommentLength);
        builder.HasIndex(e => new { e.BranchId, e.OpenedAt });

        // MVP rule: at most one open shift per branch.
        builder.HasIndex(e => e.BranchId).IsUnique().HasFilter("status = 'open'")
            .HasDatabaseName("ix_cash_shifts_branch_id_open");
        builder.HasOne<User>().WithMany()
            .HasForeignKey(e => e.OpenedBy).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany()
            .HasForeignKey(e => e.ClosedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
