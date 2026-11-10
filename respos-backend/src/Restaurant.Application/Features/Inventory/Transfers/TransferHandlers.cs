using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Transfers;

/// <summary><c>GET /stock/transfers</c>: outgoing + incoming (non-draft) transfers of the current branch, number desc. Rows carry <c>lines: []</c>.</summary>
public sealed class ListStockTransfersHandler(ITenantContext tenant, TransferReader reader)
    : IHandler<ListStockTransfersQuery, PagedResult<StockTransferDto>>
{
    public async Task<Result<PagedResult<StockTransferDto>>> HandleAsync(ListStockTransfersQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = reader.Visible(branchId);
        if (SnakeCaseEnum.TryParse<StockTransferStatus>(request.Status, out var status))
        {
            query = query.Where(t => t.Status == status);
        }

        if (SnakeCaseEnum.TryParse<StockTransferDirection>(request.Direction, out var direction))
        {
            query = direction == StockTransferDirection.Outgoing
                ? query.Where(t => t.FromBranchId == branchId)
                : query.Where(t => t.ToBranchId == branchId);
        }

        var page = await query.OrderByDescending(t => t.Number).ToPagedResultAsync(request, cancellationToken);
        var items = await reader.ToSummariesAsync(branchId, page.Items, cancellationToken);
        return new PagedResult<StockTransferDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}

public sealed class GetStockTransferHandler(ITenantContext tenant, TransferReader reader) : IHandler<GetStockTransferQuery, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> HandleAsync(GetStockTransferQuery request, CancellationToken cancellationToken) =>
        await reader.GetAsync(tenant.RequireBranchId(), request.Id, cancellationToken) is { } dto ? dto : StockTransferErrors.NotFound;
}

/// <summary>
/// Creates a draft from the X-Branch-Id branch or replaces a draft's header and lines (non-draft → 409 <c>stock_transfer.not_editable</c>).
/// Destination: another active branch of the org (the sender does not need access to it; receiving does).
/// </summary>
public sealed class SaveStockTransferHandler(
    IApplicationDbContext db, ITenantContext tenant, UnitConverter converter, TransferReader reader, IAuditLogger audit)
    : IHandler<SaveStockTransferCommand, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> HandleAsync(SaveStockTransferCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        if (request.ToBranchId == branchId)
        {
            return StockTransferErrors.SameBranch;
        }

        if (!await db.Branches.AnyAsync(b => b.Id == request.ToBranchId && b.IsActive, cancellationToken))
        {
            return StockTransferErrors.DestinationNotFound;
        }

        var lines = await BuildLinesAsync(orgId, request.Lines, cancellationToken);
        if (lines.IsFailure)
        {
            return lines.Error;
        }

        StockTransfer? transfer;
        if (request.Id is { } id)
        {
            transfer = await db.StockTransfers.Include(t => t.Lines).Where(TransferReader.VisibleTo(branchId))
                .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
            if (transfer is null)
            {
                return StockTransferErrors.NotFound;
            }

            if (transfer.FromBranchId != branchId)
            {
                return StockTransferErrors.SourceOnly;
            }

            db.StockTransferLines.RemoveRange(transfer.Lines.ToList());
        }
        else
        {
            var last = await db.StockTransfers.MaxAsync(t => (int?)t.Number, cancellationToken) ?? 0;
            transfer = new StockTransfer { OrganizationId = orgId, FromBranchId = branchId, Number = last + 1 };
            db.StockTransfers.Add(transfer);
        }

        transfer.ToBranchId = request.ToBranchId;
        transfer.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        transfer.ReplaceLines(lines.Value); // non-draft → 409
        db.StockTransferLines.AddRange(lines.Value); // explicit Add: client-generated keys on a tracked parent
        audit.Log(request.Id is null ? "stock_transfer.created" : "stock_transfer.updated", nameof(StockTransfer), transfer.Id,
            new { transfer.Number, transfer.FromBranchId, transfer.ToBranchId, lines = lines.Value.Count });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, transfer.Id, cancellationToken))!;
    }

    private async Task<Result<List<StockTransferLine>>> BuildLinesAsync(
        Guid orgId, IReadOnlyList<TransferLineInput> input, CancellationToken cancellationToken)
    {
        var ids = input.Select(l => l.IngredientId).Distinct().ToList();
        var ingredients = await db.Ingredients.AsNoTracking().Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken);
        var unitIds = input.Select(l => l.UnitId).Distinct().ToList();
        if (await db.Units.CountAsync(u => unitIds.Contains(u.Id), cancellationToken) != unitIds.Count)
        {
            return InventoryErrors.UnitNotFound;
        }

        var lines = new List<StockTransferLine>(input.Count);
        foreach (var line in input)
        {
            if (!ingredients.TryGetValue(line.IngredientId, out var ingredient))
            {
                return InventoryErrors.IngredientNotFound;
            }

            if (ingredient.IsArchived)
            {
                return InventoryErrors.IngredientArchived;
            }

            var baseQuantity = await converter.ToBaseAsync(orgId, line.Quantity, line.UnitId, ingredient.BaseUnitId, cancellationToken);
            if (baseQuantity.IsFailure)
            {
                return baseQuantity.Error;
            }

            lines.Add(new StockTransferLine
            {
                IngredientId = line.IngredientId,
                Quantity = line.Quantity,
                UnitId = line.UnitId,
                BaseQuantity = baseQuantity.Value,
            });
        }

        return lines;
    }
}
