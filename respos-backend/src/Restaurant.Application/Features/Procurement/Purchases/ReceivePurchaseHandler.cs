using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Procurement.Purchases;

/// <summary>
/// <c>POST /purchases/{id}/receive</c> (Idempotency-Key at HTTP level): each line ≤ remaining → <c>receipt</c> movement
/// in the ingredient base unit, CostPrice = last purchase price per base unit; status partially_received / received;
/// raises <c>PurchaseReceivedDomainEvent</c>. All in one unit of work.
/// </summary>
public sealed class ReceivePurchaseHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, UnitConverter converter, PurchaseReader reader, IAuditLogger audit)
    : IHandler<ReceivePurchaseCommand, PurchaseDto>
{
    public async Task<Result<PurchaseDto>> HandleAsync(ReceivePurchaseCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var po = await db.PurchaseOrders.Include(p => p.Items).ThenInclude(i => i.Ingredient)
            .FirstOrDefaultAsync(p => p.Id == request.Id && p.BranchId == branchId, cancellationToken);
        if (po is null)
        {
            return ProcurementErrors.PurchaseNotFound;
        }

        po.EnsureReceivable();
        var received = new List<object>();
        foreach (var line in request.Lines)
        {
            var item = po.ReceiveLine(line.ItemId, line.Quantity);
            var ingredient = item.Ingredient!;
            var baseQuantity = await converter.ToBaseAsync(orgId, line.Quantity, item.UnitId, ingredient.BaseUnitId, cancellationToken);
            if (baseQuantity.IsFailure)
            {
                return baseQuantity.Error;
            }

            decimal? unitCost = baseQuantity.Value == 0 ? null : Money.Round(item.UnitPrice * line.Quantity / baseQuantity.Value);
            if (unitCost is { } cost)
            {
                ingredient.CostPrice = cost;
            }

            var movement = await ledger.ApplyAsync(
                new StockChange(orgId, branchId, ingredient.Id, StockMovementType.Receipt, baseQuantity.Value, StockMovementSource.Purchase)
                {
                    SourceId = po.Id,
                    UnitCost = unitCost,
                    Reason = $"Purchase #{po.Number}",
                },
                allowNegative: false,
                cancellationToken);
            received.Add(new { itemId = item.Id, ingredientId = ingredient.Id, quantity = line.Quantity, baseQuantity = movement.Quantity });
        }

        po.CompleteReceipt();
        audit.Log("purchase.received", nameof(PurchaseOrder), po.Id, new { po.Number, status = po.Status, lines = received });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, po.Id, cancellationToken))!;
    }
}
