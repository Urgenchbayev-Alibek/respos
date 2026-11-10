using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Transfers;

/// <summary>
/// <c>POST /stock/transfers/{id}/send</c> (source branch only): draft → sent. Each line gets its base quantity and unit cost
/// (ingredient CostPrice) fixed and a <c>transfer_out</c> movement at the source via <see cref="StockLedger"/>, honouring the
/// source's AllowNegativeStock (409 <c>stock.insufficient</c> → nothing is saved). One unit of work.
/// </summary>
public sealed class SendStockTransferHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, StockLedger ledger, UnitConverter converter, TransferReader reader,
    IAuditLogger audit) : IHandler<StockTransferActionCommand, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> HandleAsync(StockTransferActionCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var transfer = await TransferLoader.LoadAsync(db, branchId, request.Id, cancellationToken);
        if (transfer is null)
        {
            return StockTransferErrors.NotFound;
        }

        if (transfer.FromBranchId != branchId)
        {
            return StockTransferErrors.SourceOnly;
        }

        var destination = await db.Branches.AsNoTracking()
            .Where(b => b.Id == transfer.ToBranchId && b.IsActive).Select(b => b.Name).FirstOrDefaultAsync(cancellationToken);
        if (destination is null)
        {
            return StockTransferErrors.DestinationNotFound;
        }

        transfer.MarkSent(tenant.RequireUserId(), clock.UtcNow); // invalid transition / empty → DomainException
        var allowNegative = await ledger.AllowNegativeAsync(orgId, branchId, cancellationToken);
        foreach (var line in transfer.Lines)
        {
            var ingredient = line.Ingredient!;
            var baseQuantity = await converter.ToBaseAsync(orgId, line.Quantity, line.UnitId, ingredient.BaseUnitId, cancellationToken);
            if (baseQuantity.IsFailure)
            {
                return baseQuantity.Error;
            }

            line.BaseQuantity = baseQuantity.Value;
            line.UnitCost = ingredient.CostPrice;
            await ledger.ApplyAsync(
                new StockChange(orgId, branchId, ingredient.Id, StockMovementType.TransferOut, -line.BaseQuantity, StockMovementSource.Transfer)
                {
                    SourceId = transfer.Id,
                    UnitCost = line.UnitCost,
                    Reason = $"Transfer #{transfer.Number} → {destination}",
                },
                allowNegative,
                cancellationToken);
        }

        audit.Log("stock_transfer.sent", nameof(StockTransfer), transfer.Id,
            new { transfer.Number, transfer.ToBranchId, lines = transfer.Lines.Count });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, transfer.Id, cancellationToken))!;
    }
}

/// <summary>
/// <c>POST /stock/transfers/{id}/receive</c> (Idempotency-Key; destination branch only, i.e. the user needs access to it):
/// sent → received; <c>transfer_in</c> movements at the destination with the cost fixed on send. A second receive → 409.
/// </summary>
public sealed class ReceiveStockTransferHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, StockLedger ledger, TransferReader reader, IAuditLogger audit)
    : IHandler<StockTransferActionCommand, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> HandleAsync(StockTransferActionCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var transfer = await TransferLoader.LoadAsync(db, branchId, request.Id, cancellationToken);
        if (transfer is null)
        {
            return StockTransferErrors.NotFound;
        }

        if (transfer.ToBranchId != branchId)
        {
            return StockTransferErrors.DestinationOnly;
        }

        transfer.MarkReceived(tenant.RequireUserId(), clock.UtcNow);
        var source = await db.Branches.AsNoTracking()
            .Where(b => b.Id == transfer.FromBranchId).Select(b => b.Name).FirstOrDefaultAsync(cancellationToken);
        foreach (var line in transfer.Lines)
        {
            await ledger.ApplyAsync(
                new StockChange(orgId, branchId, line.IngredientId, StockMovementType.TransferIn, line.BaseQuantity, StockMovementSource.Transfer)
                {
                    SourceId = transfer.Id,
                    UnitCost = line.UnitCost,
                    Reason = $"Transfer #{transfer.Number} ← {source}",
                },
                allowNegative: true,
                cancellationToken);
        }

        audit.Log("stock_transfer.received", nameof(StockTransfer), transfer.Id, new { transfer.Number, transfer.FromBranchId });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, transfer.Id, cancellationToken))!;
    }
}

/// <summary>
/// <c>POST /stock/transfers/{id}/cancel</c> (source branch only): draft|sent → cancelled. A sent transfer returns its stock to
/// the source with <c>transfer_in</c> movements (same quantities and cost).
/// </summary>
public sealed class CancelStockTransferHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, StockLedger ledger, TransferReader reader, IAuditLogger audit)
    : IHandler<StockTransferActionCommand, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> HandleAsync(StockTransferActionCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var transfer = await TransferLoader.LoadAsync(db, branchId, request.Id, cancellationToken);
        if (transfer is null)
        {
            return StockTransferErrors.NotFound;
        }

        if (transfer.FromBranchId != branchId)
        {
            return StockTransferErrors.SourceOnly;
        }

        var previous = transfer.Cancel(tenant.RequireUserId(), clock.UtcNow);
        if (previous == StockTransferStatus.Sent)
        {
            foreach (var line in transfer.Lines)
            {
                await ledger.ApplyAsync(
                    new StockChange(orgId, branchId, line.IngredientId, StockMovementType.TransferIn, line.BaseQuantity, StockMovementSource.Transfer)
                    {
                        SourceId = transfer.Id,
                        UnitCost = line.UnitCost,
                        Reason = $"Transfer #{transfer.Number} cancelled",
                    },
                    allowNegative: true,
                    cancellationToken);
            }
        }

        audit.Log("stock_transfer.cancelled", nameof(StockTransfer), transfer.Id, new { transfer.Number, from = previous });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, transfer.Id, cancellationToken))!;
    }
}

internal static class TransferLoader
{
    /// <summary>Tracked transfer with lines + ingredients, visible to <paramref name="branchId"/> (else null → 404).</summary>
    public static Task<StockTransfer?> LoadAsync(IApplicationDbContext db, Guid branchId, Guid id, CancellationToken ct) =>
        db.StockTransfers
            .Include(t => t.Lines).ThenInclude(l => l.Ingredient)
            .Where(TransferReader.VisibleTo(branchId))
            .FirstOrDefaultAsync(t => t.Id == id, ct);
}
