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

internal sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Quantity).IsQuantity();
        builder.Property(e => e.BalanceAfter).IsQuantity();
        builder.Property(e => e.Reason).HasMaxLength(ReasonLength);
        builder.HasIndex(e => new { e.BranchId, e.CreatedAt });
        builder.HasIndex(e => new { e.BranchId, e.IngredientId, e.CreatedAt });
        builder.HasIndex(e => new { e.SourceType, e.SourceId });
        builder.HasOne(e => e.Ingredient).WithMany()
            .HasForeignKey(e => e.IngredientId).OnDelete(DeleteBehavior.Restrict);
    }
}
