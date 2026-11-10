using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Application.Features.Procurement.Purchases;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Application.Features.Procurement.Suggestions;

/// <summary>
/// Purchase suggestions for the X-Branch-Id branch (formula on <see cref="GetPurchaseSuggestionsQuery"/>). Consumption = order
/// <c>consumption</c> movements; on order = remaining quantity of draft/submitted/partially received POs of the branch.
/// Last price = ingredient CostPrice (last purchase price per base unit).
/// </summary>
public sealed class GetPurchaseSuggestionsHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, UnitConverter converter)
    : IHandler<GetPurchaseSuggestionsQuery, PurchaseSuggestionsDto>
{
    private static readonly PurchaseOrderStatus[] OpenStatuses =
        [PurchaseOrderStatus.Draft, PurchaseOrderStatus.Submitted, PurchaseOrderStatus.PartiallyReceived];

    public async Task<Result<PurchaseSuggestionsDto>> HandleAsync(GetPurchaseSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var balances = await db.StockBalances.AsNoTracking()
            .Where(b => b.BranchId == branchId && !b.Ingredient!.IsArchived)
            .Select(b => new
            {
                b.IngredientId, b.Quantity, b.MinQuantity, b.Ingredient!.Name, b.Ingredient.BaseUnitId,
                BaseUnitCode = b.Ingredient.BaseUnit!.Code, b.Ingredient.CostPrice, b.Ingredient.DefaultSupplierId,
            })
            .ToListAsync(cancellationToken);
        var consumption = await ConsumptionAsync(branchId, request.LookbackDays, cancellationToken);
        var onOrder = await OnOrderAsync(orgId, branchId, balances.ToDictionary(b => b.IngredientId, b => b.BaseUnitId), cancellationToken);
        var suppliers = await db.Suppliers.AsNoTracking().Where(s => !s.IsArchived).ToDictionaryAsync(s => s.Id, s => s.Name, cancellationToken);

        var lines = new List<(Guid? SupplierId, PurchaseSuggestionLineDto Line)>();
        foreach (var b in balances)
        {
            var avgDaily = UnitConverter.RoundQuantity(consumption.GetValueOrDefault(b.IngredientId) / request.LookbackDays);
            var target = UnitConverter.RoundQuantity(b.MinQuantity + avgDaily * request.CoverageDays);
            var pending = onOrder.GetValueOrDefault(b.IngredientId);
            var suggested = CeilQuantity(target - b.Quantity - pending);
            if (suggested <= 0)
            {
                continue;
            }

            Guid? supplierId = b.DefaultSupplierId is { } s && suppliers.ContainsKey(s) ? s : null;
            lines.Add((supplierId, new PurchaseSuggestionLineDto(
                b.IngredientId, b.Name, b.BaseUnitId, b.BaseUnitCode, b.Quantity, b.MinQuantity, pending, avgDaily, target, suggested,
                b.CostPrice, Money.Round(suggested * b.CostPrice))));
        }

        var groups = lines
            .GroupBy(l => l.SupplierId)
            .Select(g => new PurchaseSuggestionGroupDto(
                g.Key,
                g.Key is { } id ? suppliers[id] : null,
                Money.Round(g.Sum(l => l.Line.EstimatedTotal)),
                g.Select(l => l.Line).OrderBy(l => l.IngredientName).ToList()))
            .OrderBy(g => g.SupplierId is null)
            .ThenBy(g => g.SupplierName)
            .ToList();
        return new PurchaseSuggestionsDto(request.CoverageDays, request.LookbackDays, groups);
    }

    /// <summary>Rounds up to 3 decimals (never order less than needed).</summary>
    public static decimal CeilQuantity(decimal quantity) => Math.Ceiling(quantity * 1000m) / 1000m;

    private async Task<Dictionary<Guid, decimal>> ConsumptionAsync(Guid branchId, int lookbackDays, CancellationToken ct)
    {
        var since = clock.UtcNow.AddDays(-lookbackDays);
        return await db.StockMovements.AsNoTracking()
            .Where(m => m.BranchId == branchId && m.Type == StockMovementType.Consumption && m.CreatedAt >= since)
            .GroupBy(m => m.IngredientId)
            .Select(g => new { g.Key, Quantity = -g.Sum(m => m.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => Math.Max(0m, x.Quantity), ct);
    }

    private async Task<Dictionary<Guid, decimal>> OnOrderAsync(
        Guid orgId, Guid branchId, IReadOnlyDictionary<Guid, Guid> baseUnits, CancellationToken ct)
    {
        var items = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => i.Quantity > i.ReceivedQuantity && db.PurchaseOrders.Any(
                p => p.Id == i.PurchaseOrderId && p.BranchId == branchId && OpenStatuses.Contains(p.Status)))
            .Select(i => new { i.IngredientId, i.UnitId, Remaining = i.Quantity - i.ReceivedQuantity })
            .ToListAsync(ct);
        var result = new Dictionary<Guid, decimal>();
        foreach (var item in items)
        {
            if (!baseUnits.TryGetValue(item.IngredientId, out var baseUnitId)
                || await converter.TryGetFactorAsync(orgId, item.UnitId, baseUnitId, ct) is not { } factor)
            {
                continue;
            }

            result[item.IngredientId] = UnitConverter.RoundQuantity(result.GetValueOrDefault(item.IngredientId) + item.Remaining * factor);
        }

        return result;
    }
}

/// <summary>
/// Creates one draft purchase order per supplier (base unit, price = given or CostPrice) through <see cref="SavePurchaseHandler"/>
/// inside one transaction: any failure (e.g. archived supplier) rolls back every draft.
/// </summary>
public sealed class ApplyPurchaseSuggestionsHandler(IApplicationDbContext db, SavePurchaseHandler save)
    : IHandler<ApplyPurchaseSuggestionsCommand, IReadOnlyList<PurchaseDto>>
{
    public async Task<Result<IReadOnlyList<PurchaseDto>>> HandleAsync(ApplyPurchaseSuggestionsCommand request, CancellationToken cancellationToken)
    {
        var ids = request.Lines.Select(l => l.IngredientId).Distinct().ToList();
        var ingredients = await db.Ingredients.AsNoTracking().Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken);
        if (ingredients.Count != ids.Count)
        {
            return InventoryErrors.IngredientNotFound;
        }

        var drafts = request.Lines
            .GroupBy(l => l.SupplierId)
            .Select(g => new SavePurchaseCommand(g.Key, request.ExpectedAt, request.Comment, g
                .Select(l => new PurchaseLine(l.IngredientId, l.Quantity, ingredients[l.IngredientId].BaseUnitId,
                    l.UnitPrice ?? ingredients[l.IngredientId].CostPrice))
                .ToList()))
            .ToList();

        var created = await db.ExecuteInTransactionAsync<IReadOnlyList<PurchaseDto>>(async ct =>
        {
            var list = new List<PurchaseDto>(drafts.Count);
            foreach (var draft in drafts)
            {
                var result = await save.HandleAsync(draft, ct);
                if (result.IsFailure)
                {
                    throw new DomainException(result.Error); // rolls back the drafts created so far
                }

                list.Add(result.Value);
            }

            return list;
        }, cancellationToken);
        return Result.Success(created);
    }
}
