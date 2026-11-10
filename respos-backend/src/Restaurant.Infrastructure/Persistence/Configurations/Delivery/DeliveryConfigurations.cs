using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Orders;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations.Delivery;

internal sealed class CourierConfiguration : IEntityTypeConfiguration<Courier>
{
    public void Configure(EntityTypeBuilder<Courier> builder)
    {
        builder.ToTable("couriers");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(PhoneLength).IsRequired();
    }
}

internal sealed class OrderDeliveryConfiguration : IEntityTypeConfiguration<OrderDelivery>
{
    public const int AddressLength = 500;
    public const int ShortLength = 32;

    public void Configure(EntityTypeBuilder<OrderDelivery> builder)
    {
        builder.ToTable("order_deliveries");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.HasIndex(e => e.OrderId).IsUnique();
        builder.HasIndex(e => new { e.BranchId, e.Status });
        builder.HasIndex(e => e.CourierId);
        builder.Property(e => e.CustomerName).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.CustomerPhone).HasMaxLength(PhoneLength).IsRequired();
        builder.Property(e => e.Address).HasMaxLength(AddressLength).IsRequired();
        builder.Property(e => e.Entrance).HasMaxLength(ShortLength);
        builder.Property(e => e.Floor).HasMaxLength(ShortLength);
        builder.Property(e => e.Apartment).HasMaxLength(ShortLength);
        builder.Property(e => e.Comment).HasMaxLength(CommentLength);
        builder.Property(e => e.CancelReason).HasMaxLength(ReasonLength);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasOne<Order>().WithOne()
            .HasForeignKey<OrderDelivery>(e => e.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Courier>().WithMany()
            .HasForeignKey(e => e.CourierId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class WaiterCallConfiguration : IEntityTypeConfiguration<WaiterCall>
{
    private const int TableNumberLength = 20;

    public void Configure(EntityTypeBuilder<WaiterCall> builder)
    {
        builder.ToTable("waiter_calls");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.HasIndex(e => new { e.BranchId, e.Status, e.CreatedAt });
        builder.Property(e => e.TableNumber).HasMaxLength(TableNumberLength).IsRequired();
        builder.HasOne<DiningTable>().WithMany()
            .HasForeignKey(e => e.TableId).OnDelete(DeleteBehavior.Cascade);
    }
}
