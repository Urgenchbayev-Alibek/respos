using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Inventory;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class StockTransferConfiguration : IEntityTypeConfiguration<StockTransfer>
{
    public void Configure(EntityTypeBuilder<StockTransfer> builder)
    {
        builder.ToTable("stock_transfers");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Comment).HasMaxLength(CommentLength);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasIndex(e => new { e.OrganizationId, e.Number }).IsUnique();
        builder.HasIndex(e => new { e.FromBranchId, e.Status });
        builder.HasIndex(e => new { e.ToBranchId, e.Status });
        builder.HasOne<RestaurantBranch>().WithMany()
            .HasForeignKey(e => e.FromBranchId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<RestaurantBranch>().WithMany()
            .HasForeignKey(e => e.ToBranchId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Lines).WithOne()
            .HasForeignKey(l => l.StockTransferId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class StockTransferLineConfiguration : IEntityTypeConfiguration<StockTransferLine>
{
    public void Configure(EntityTypeBuilder<StockTransferLine> builder)
    {
        builder.ToTable("stock_transfer_lines");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Quantity).IsQuantity();
        builder.Property(e => e.BaseQuantity).IsQuantity();
        builder.HasIndex(e => e.StockTransferId);
        builder.HasOne(e => e.Ingredient).WithMany()
            .HasForeignKey(e => e.IngredientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.Unit).WithMany()
            .HasForeignKey(e => e.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}
