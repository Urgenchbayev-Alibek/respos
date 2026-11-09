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

namespace Restaurant.Application.Features.Inventory.StockMovements;

/// <summary>
/// Manual movement (write_off / adjustment / receipt) through <see cref="StockLedger"/>. Cannot go negative unless
/// <c>BranchSettings.AllowNegativeStock</c> (409 <c>stock.insufficient</c>). Receipt with a unit cost updates CostPrice. Audited.
/// </summary>
public sealed class CreateStockMovementHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, UnitConverter converter, StockMovementReader reader, IAuditLogger audit)
    : IHandler<CreateStockMovementCommand, StockMovementDto>
{
    public async Task<Result<StockMovementDto>> HandleAsync(CreateStockMovementCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var ingredient = await db.Ingredients.FirstOrDefaultAsync(i => i.Id == request.IngredientId, cancellationToken);
        if (ingredient is null)
        {
            return InventoryErrors.IngredientNotFound;
        }

        if (ingredient.IsArchived)
        {
            return InventoryErrors.IngredientArchived;
        }

        var unitId = request.UnitId ?? ingredient.BaseUnitId;
        var baseQuantity = await converter.ToBaseAsync(orgId, request.Quantity, unitId, ingredient.BaseUnitId, cancellationToken);
        if (baseQuantity.IsFailure)
        {
            return baseQuantity.Error;
        }

        var signed = request.Type == StockMovementType.WriteOff ? -baseQuantity.Value : baseQuantity.Value;
        decimal? unitCost = null;
        if (request.UnitCost is { } cost && baseQuantity.Value != 0)
        {
            unitCost = Money.Round(cost * request.Quantity / baseQuantity.Value);
            if (request.Type == StockMovementType.Receipt)
            {
                ingredient.CostPrice = unitCost.Value;
            }
        }

        var allowNegative = await ledger.AllowNegativeAsync(orgId, branchId, cancellationToken);
        var movement = await ledger.ApplyAsync(
            new StockChange(orgId, branchId, ingredient.Id, request.Type, signed, StockMovementSource.Manual)
            {
                UnitCost = unitCost,
                Reason = request.Reason.Trim(),
            },
            allowNegative,
            cancellationToken);
        audit.Log("stock.movement_created", nameof(StockMovement), movement.Id, new
        {
            ingredientId = ingredient.Id,
            type = request.Type,
            quantity = movement.Quantity,
            balanceAfter = movement.BalanceAfter,
            reason = movement.Reason,
        });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.Project(reader.Movements(branchId).Where(m => m.Id == movement.Id)).FirstAsync(cancellationToken);
    }
}

public sealed class ListStockMovementsHandler(ITenantContext tenant, StockMovementReader reader)
    : IHandler<ListStockMovementsQuery, PagedResult<StockMovementDto>>
{
    public async Task<Result<PagedResult<StockMovementDto>>> HandleAsync(ListStockMovementsQuery request, CancellationToken cancellationToken)
    {
        var query = reader.Movements(tenant.RequireBranchId());
        if (request.IngredientId is { } ingredientId)
        {
            query = query.Where(m => m.IngredientId == ingredientId);
        }

        if (SnakeCaseEnum.TryParse<StockMovementType>(request.Type, out var type))
        {
            query = query.Where(m => m.Type == type);
        }

        if (SnakeCaseEnum.TryParse<StockMovementSource>(request.SourceType, out var source))
        {
            query = query.Where(m => m.SourceType == source);
        }

        if (request.From is { } from)
        {
            var fromUtc = from.ToUniversalTime();
            query = query.Where(m => m.CreatedAt >= fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = to.ToUniversalTime();
            query = query.Where(m => m.CreatedAt <= toUtc);
        }

        return await reader.Project(query.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

[ScopedService]
public sealed class StockMovementReader(IApplicationDbContext db)
{
    /// <summary>Branch-scoped movements; filter/order on the entity, then <see cref="Project"/> (DTO members are not translatable).</summary>
    public IQueryable<StockMovement> Movements(Guid branchId) =>
        db.StockMovements.AsNoTracking().Where(m => m.BranchId == branchId);

    public IQueryable<StockMovementDto> Project(IQueryable<StockMovement> movements) =>
        from m in movements
        join u in db.Users on m.CreatedBy equals (Guid?)u.Id into users
        from u in users.DefaultIfEmpty()
        select new StockMovementDto(
            m.Id,
            m.IngredientId,
            m.Ingredient!.Name,
            m.Ingredient.BaseUnit!.Code,
            m.Type,
            m.Quantity,
            m.BalanceAfter,
            m.UnitCost,
            m.SourceType,
            m.SourceId,
            m.Reason,
            m.CreatedBy,
            u == null ? null : u.FullName,
            m.CreatedAt);
}
