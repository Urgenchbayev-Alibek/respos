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

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Provider).HasMaxLength(32).IsRequired();
        builder.Property(e => e.ExternalReference).HasMaxLength(NameLength);
        builder.Property(e => e.IdempotencyKey).HasMaxLength(100).IsRequired();
        builder.HasIndex(e => new { e.OrganizationId, e.IdempotencyKey }).IsUnique();
        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.CashShiftId);
        builder.HasIndex(e => new { e.BranchId, e.CreatedAt });
        builder.HasOne<Order>().WithMany()
            .HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CashShift>().WithMany()
            .HasForeignKey(e => e.CashShiftId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Refunds).WithOne()
            .HasForeignKey(r => r.PaymentId).OnDelete(DeleteBehavior.Restrict);
    }
}
