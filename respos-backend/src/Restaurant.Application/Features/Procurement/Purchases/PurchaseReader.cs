using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Procurement.Purchases;

[ScopedService]
public sealed class PurchaseReader(IApplicationDbContext db)
{
    public async Task<PurchaseDto?> GetAsync(Guid branchId, Guid id, CancellationToken cancellationToken)
    {
        var po = await db.PurchaseOrders.AsNoTracking()
            .Where(p => p.Id == id && p.BranchId == branchId)
            .Select(p => new { p.Id, p.Number, p.SupplierId, SupplierName = p.Supplier!.Name, p.Status, p.ExpectedAt, p.Total, p.Comment, p.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (po is null)
        {
            return null;
        }

        var items = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => i.PurchaseOrderId == id)
            .OrderBy(i => i.Ingredient!.Name)
            .Select(i => new { i.Id, i.IngredientId, Name = i.Ingredient!.Name, i.Quantity, i.UnitId, UnitCode = i.Unit!.Code, i.UnitPrice, i.ReceivedQuantity })
            .ToListAsync(cancellationToken);
        var dtoItems = items.Select(i => new PurchaseItemDto(
            i.Id, i.IngredientId, i.Name, i.Quantity, i.UnitId, i.UnitCode, i.UnitPrice, i.ReceivedQuantity, Money.Round(i.Quantity * i.UnitPrice)))
            .ToList();
        return new PurchaseDto(po.Id, po.Number, po.SupplierId, po.SupplierName, po.Status, po.ExpectedAt, po.Total, po.Comment, po.CreatedAt, dtoItems);
    }
}
