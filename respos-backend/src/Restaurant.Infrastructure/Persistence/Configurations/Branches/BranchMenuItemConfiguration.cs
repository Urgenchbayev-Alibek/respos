using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class BranchMenuItemConfiguration : IEntityTypeConfiguration<BranchMenuItem>
{
    public void Configure(EntityTypeBuilder<BranchMenuItem> builder)
    {
        builder.ToTable("branch_menu_items");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.HasIndex(e => new { e.BranchId, e.MenuItemId }).IsUnique();
        builder.HasOne(e => e.MenuItem).WithMany()
            .HasForeignKey(e => e.MenuItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<KitchenStation>().WithMany()
            .HasForeignKey(e => e.KitchenStationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.VariantPrices).WithOne()
            .HasForeignKey(v => v.BranchMenuItemId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class BranchMenuItemVariantPriceConfiguration : IEntityTypeConfiguration<BranchMenuItemVariantPrice>
{
    public void Configure(EntityTypeBuilder<BranchMenuItemVariantPrice> builder)
    {
        builder.ToTable("branch_menu_item_variant_prices");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.BranchMenuItemId, e.VariantId }).IsUnique();
        builder.HasOne<MenuItemVariant>().WithMany()
            .HasForeignKey(e => e.VariantId).OnDelete(DeleteBehavior.Restrict);
    }
}
