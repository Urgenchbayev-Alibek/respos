using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Multi-branch module (F4) DbSets: per-branch menu overrides and stock transfers.</summary>
public partial interface IApplicationDbContext
{
    DbSet<BranchMenuItem> BranchMenuItems { get; }
    DbSet<BranchMenuItemVariantPrice> BranchMenuItemVariantPrices { get; }
    DbSet<StockTransfer> StockTransfers { get; }
    DbSet<StockTransferLine> StockTransferLines { get; }
}
