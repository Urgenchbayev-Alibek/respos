using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Multi-branch module DbSets (implements IApplicationDbContext.Branches.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<BranchMenuItem> BranchMenuItems => Set<BranchMenuItem>();
    public DbSet<BranchMenuItemVariantPrice> BranchMenuItemVariantPrices => Set<BranchMenuItemVariantPrice>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<StockTransferLine> StockTransferLines => Set<StockTransferLine>();
}
