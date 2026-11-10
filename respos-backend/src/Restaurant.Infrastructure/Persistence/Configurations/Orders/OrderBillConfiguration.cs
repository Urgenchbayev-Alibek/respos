using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Infrastructure.Persistence.Configurations;

/// <summary>F2 split bills: child of <see cref="Order"/> (cascade), referenced by <see cref="Payment.BillId"/> (restrict).</summary>
internal sealed class OrderBillConfiguration : IEntityTypeConfiguration<OrderBill>
{
    public void Configure(EntityTypeBuilder<OrderBill> builder)
    {
        builder.ToTable("order_bills");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.HasIndex(e => new { e.OrderId, e.Number }).IsUnique();
        builder.HasOne<Order>().WithMany(o => o.Bills)
            .HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.Items).WithOne()
            .HasForeignKey(i => i.BillId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany<Payment>().WithOne()
            .HasForeignKey(p => p.BillId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OrderBillItemConfiguration : IEntityTypeConfiguration<OrderBillItem>
{
    public void Configure(EntityTypeBuilder<OrderBillItem> builder)
    {
        builder.ToTable("order_bill_items");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Quantity).IsQuantity();
        builder.HasIndex(e => e.OrderItemId);
        builder.HasOne<OrderItem>().WithMany()
            .HasForeignKey(e => e.OrderItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
