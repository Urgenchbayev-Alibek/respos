using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Common;

/// <summary>A signed stock change in the ingredient base unit (+ in, − out).</summary>
public sealed record StockChange(
    Guid OrganizationId,
    Guid BranchId,
    Guid IngredientId,
    StockMovementType Type,
    decimal Quantity,
    StockMovementSource SourceType)
{
    public Guid? SourceId { get; init; }
    public decimal? UnitCost { get; init; }
    public string? Reason { get; init; }
}

/// <summary>
/// The ONLY way to change stock: creates a <see cref="StockMovement"/> and applies it to the (lazily created)
/// <see cref="StockBalance"/> in the caller's unit of work, stamping BalanceAfter. Balance concurrency = xmin.
/// Org/branch are explicit so it also works from domain event handlers.
/// </summary>
[ScopedService]
public sealed class StockLedger(IApplicationDbContext db, ITenantContext tenant, IClock clock)
{
    public async Task<StockBalance> GetOrCreateBalanceAsync(
        Guid organizationId, Guid branchId, Guid ingredientId, CancellationToken cancellationToken)
    {
        var balance = db.StockBalances.Local.FirstOrDefault(b => b.BranchId == branchId && b.IngredientId == ingredientId)
            ?? await db.StockBalances.IgnoreQueryFilters().FirstOrDefaultAsync(
                b => b.OrganizationId == organizationId && b.BranchId == branchId && b.IngredientId == ingredientId,
                cancellationToken);
        if (balance is null)
        {
            balance = StockBalance.Create(organizationId, branchId, ingredientId);
            db.StockBalances.Add(balance);
        }

        return balance;
    }

    public Task<bool> AllowNegativeAsync(Guid organizationId, Guid branchId, CancellationToken cancellationToken) =>
        db.BranchSettings.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == organizationId && s.BranchId == branchId)
            .Select(s => s.AllowNegativeStock)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>Throws 409 <c>stock.insufficient</c> when the result is negative and <paramref name="allowNegative"/> is false.</summary>
    public async Task<StockMovement> ApplyAsync(StockChange change, bool allowNegative, CancellationToken cancellationToken)
    {
        var balance = await GetOrCreateBalanceAsync(change.OrganizationId, change.BranchId, change.IngredientId, cancellationToken);
        var movement = new StockMovement
        {
            OrganizationId = change.OrganizationId,
            BranchId = change.BranchId,
            IngredientId = change.IngredientId,
            Type = change.Type,
            Quantity = change.Quantity,
            UnitCost = change.UnitCost,
            SourceType = change.SourceType,
            SourceId = change.SourceId,
            Reason = change.Reason,
            CreatedBy = tenant.UserId,
            CreatedAt = clock.UtcNow,
        };
        balance.Apply(movement, allowNegative);
        db.StockMovements.Add(movement);
        return movement;
    }
}
