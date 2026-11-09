using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Stock;

public sealed record StockReportQuery(bool LowOnly = false);

/// <summary><c>GET /reports/stock</c> and <c>GET /reports/low-stock</c> (quantity ≤ minimum) — current branch balances.</summary>
public sealed class StockReportHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<StockReportQuery, IReadOnlyList<StockBalanceReportDto>>
{
    public async Task<Result<IReadOnlyList<StockBalanceReportDto>>> HandleAsync(StockReportQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.StockBalances.Where(b => b.BranchId == branchId && !b.Ingredient!.IsArchived);
        if (request.LowOnly)
        {
            query = query.Where(b => b.Quantity <= b.MinQuantity);
        }

        var rows = await query
            .OrderBy(b => b.Ingredient!.Name)
            .Select(b => new
            {
                b.IngredientId,
                b.Ingredient!.Name,
                b.Ingredient.Sku,
                UnitCode = b.Ingredient.BaseUnit!.Code,
                b.Quantity,
                b.MinQuantity,
                b.Ingredient.CostPrice,
            })
            .ToListAsync(cancellationToken);
        IReadOnlyList<StockBalanceReportDto> result = rows
            .Select(r => new StockBalanceReportDto(
                r.IngredientId, r.Name, r.Sku, r.UnitCode, r.Quantity, r.MinQuantity, r.Quantity <= r.MinQuantity,
                r.CostPrice, Money.Round(r.Quantity * r.CostPrice)))
            .ToList();
        return Result.Success(result);
    }
}

/// <summary><c>GET /reports/stock-movements?from=&amp;to=</c> — signed quantity totals by movement type and ingredient.</summary>
public sealed class StockMovementsReportHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, IReadOnlyList<StockMovementTotalDto>>
{
    public async Task<Result<IReadOnlyList<StockMovementTotalDto>>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var rows = await db.StockMovements
            .Where(m => m.BranchId == ctx.BranchId && m.CreatedAt >= ctx.Utc.FromUtc && m.CreatedAt < ctx.Utc.ToUtc)
            .GroupBy(m => new { m.Type, m.IngredientId })
            .Select(g => new { g.Key.Type, g.Key.IngredientId, Quantity = g.Sum(m => m.Quantity), Count = g.Count() })
            .ToListAsync(cancellationToken);

        var ingredientIds = rows.Select(r => r.IngredientId).Distinct().ToList();
        var ingredients = await db.Ingredients.Where(i => ingredientIds.Contains(i.Id))
            .Select(i => new { i.Id, i.Name, UnitCode = i.BaseUnit!.Code })
            .ToDictionaryAsync(i => i.Id, cancellationToken);
        IReadOnlyList<StockMovementTotalDto> result = rows
            .Select(r =>
            {
                var ingredient = ingredients.GetValueOrDefault(r.IngredientId);
                return new StockMovementTotalDto(
                    r.Type, r.IngredientId, ingredient?.Name ?? string.Empty, ingredient?.UnitCode ?? string.Empty, r.Quantity, r.Count);
            })
            .OrderBy(r => r.Type).ThenBy(r => r.IngredientName)
            .ToList();
        return Result.Success(result);
    }
}
