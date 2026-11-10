using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class PaymentIntentConfiguration : IEntityTypeConfiguration<PaymentIntent>
{
    public void Configure(EntityTypeBuilder<PaymentIntent> builder)
    {
        builder.ToTable("payment_intents");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Provider).HasMaxLength(32).IsRequired();
        builder.Property(e => e.ProviderTransactionId).HasMaxLength(CodeLength);
        builder.Property(e => e.PaymentUrl).HasMaxLength(CommentLength);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasIndex(e => new { e.Provider, e.ProviderTransactionId }).IsUnique().HasFilter("provider_transaction_id IS NOT NULL");
        builder.HasIndex(e => new { e.Provider, e.ProviderTime });
        builder.HasIndex(e => new { e.OrderId, e.Status });
        builder.HasOne<Order>().WithMany()
            .HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<OrderBill>().WithMany()
            .HasForeignKey(e => e.BillId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<CashShift>().WithMany()
            .HasForeignKey(e => e.CashShiftId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Payment>().WithMany()
            .HasForeignKey(e => e.PaymentId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class BranchPaymentProviderConfiguration : IEntityTypeConfiguration<BranchPaymentProvider>
{
    public void Configure(EntityTypeBuilder<BranchPaymentProvider> builder)
    {
        builder.ToTable("branch_payment_providers");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Provider).HasMaxLength(32).IsRequired();
        builder.HasIndex(e => new { e.BranchId, e.Provider }).IsUnique();
    }
}
