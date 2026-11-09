using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.InventoryCounts;

public sealed class ListInventoryCountsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListInventoryCountsQuery, PagedResult<InventoryCountSummaryDto>>
{
    public async Task<Result<PagedResult<InventoryCountSummaryDto>>> HandleAsync(
        ListInventoryCountsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        return await db.InventoryCounts.AsNoTracking().Where(c => c.BranchId == branchId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new InventoryCountSummaryDto(c.Id, c.Status, c.Comment, c.CreatedAt, c.CompletedAt, c.Lines.Count))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

public sealed class GetInventoryCountHandler(ITenantContext tenant, InventoryCountReader reader)
    : IHandler<GetInventoryCountQuery, InventoryCountDto>
{
    public async Task<Result<InventoryCountDto>> HandleAsync(GetInventoryCountQuery request, CancellationToken cancellationToken) =>
        await reader.GetAsync(tenant.RequireBranchId(), request.Id, cancellationToken) is { } dto ? dto : InventoryErrors.CountNotFound;
}

public sealed class CreateInventoryCountHandler(
    IApplicationDbContext db, ITenantContext tenant, InventoryCountReader reader, IAuditLogger audit)
    : IHandler<CreateInventoryCountCommand, InventoryCountDto>
{
    public async Task<Result<InventoryCountDto>> HandleAsync(CreateInventoryCountCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var ingredients = db.Ingredients.AsNoTracking().Where(i => !i.IsArchived);
        if (request.IngredientIds is { Count: > 0 } ids)
        {
            ingredients = ingredients.Where(i => ids.Contains(i.Id));
        }

        var snapshot = await ingredients
            .Select(i => new
            {
                i.Id,
                Quantity = db.StockBalances.Where(b => b.BranchId == branchId && b.IngredientId == i.Id)
                    .Select(b => (decimal?)b.Quantity).FirstOrDefault() ?? 0m,
            })
            .ToListAsync(cancellationToken);

        var count = new InventoryCount { OrganizationId = orgId, BranchId = branchId, Comment = request.Comment?.Trim() };
        foreach (var line in snapshot)
        {
            count.AddLine(line.Id, line.Quantity);
        }

        db.InventoryCounts.Add(count);
        audit.Log("inventory_count.created", nameof(InventoryCount), count.Id, new { lines = count.Lines.Count });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, count.Id, cancellationToken))!;
    }
}

public sealed class UpdateInventoryCountHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, InventoryCountReader reader)
    : IHandler<UpdateInventoryCountCommand, InventoryCountDto>
{
    public async Task<Result<InventoryCountDto>> HandleAsync(UpdateInventoryCountCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var count = await db.InventoryCounts.Include(c => c.Lines)
            .FirstOrDefaultAsync(c => c.Id == request.Id && c.BranchId == branchId, cancellationToken);
        if (count is null)
        {
            return InventoryErrors.CountNotFound;
        }

        count.EnsureDraft();
        var newIds = request.Lines.Select(l => l.IngredientId).Where(id => count.Lines.All(x => x.IngredientId != id)).ToList();
        if (newIds.Count > 0)
        {
            var known = await db.Ingredients.CountAsync(i => newIds.Contains(i.Id) && !i.IsArchived, cancellationToken);
            if (known != newIds.Count)
            {
                return InventoryErrors.IngredientNotFound;
            }

            foreach (var id in newIds)
            {
                var expected = (await ledger.GetOrCreateBalanceAsync(orgId, branchId, id, cancellationToken)).Quantity;
                db.InventoryCountLines.Add(count.AddLine(id, expected)); // explicit Add: client-generated key on a tracked parent
            }
        }

        foreach (var line in request.Lines)
        {
            count.SetCounted(line.IngredientId, line.CountedQty);
        }

        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, count.Id, cancellationToken))!;
    }
}

/// <summary>Completes a draft: one <c>inventory_count</c> movement per line with counted ≠ expected (difference). Immutable afterwards.</summary>
public sealed class CompleteInventoryCountHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, InventoryCountReader reader, IClock clock, IAuditLogger audit)
    : IHandler<CompleteInventoryCountCommand, InventoryCountDto>
{
    public async Task<Result<InventoryCountDto>> HandleAsync(CompleteInventoryCountCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var count = await db.InventoryCounts.Include(c => c.Lines)
            .FirstOrDefaultAsync(c => c.Id == request.Id && c.BranchId == branchId, cancellationToken);
        if (count is null)
        {
            return InventoryErrors.CountNotFound;
        }

        var differences = count.Differences();
        count.Complete(clock.UtcNow);
        foreach (var (ingredientId, difference) in differences)
        {
            // A physical count reflects reality, so it may correct the balance below zero (sales after the snapshot).
            await ledger.ApplyAsync(
                new StockChange(orgId, branchId, ingredientId, StockMovementType.InventoryCount, difference, StockMovementSource.InventoryCount)
                {
                    SourceId = count.Id,
                    Reason = "Inventory count",
                },
                allowNegative: true,
                cancellationToken);
        }

        audit.Log("inventory_count.completed", nameof(InventoryCount), count.Id, new { adjustments = differences.Count });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, count.Id, cancellationToken))!;
    }
}

[ScopedService]
public sealed class InventoryCountReader(IApplicationDbContext db)
{
    public async Task<InventoryCountDto?> GetAsync(Guid branchId, Guid id, CancellationToken cancellationToken)
    {
        var count = await db.InventoryCounts.AsNoTracking()
            .Where(c => c.Id == id && c.BranchId == branchId)
            .Select(c => new { c.Id, c.Status, c.Comment, c.CreatedAt, c.CompletedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (count is null)
        {
            return null;
        }

        var lines = await db.InventoryCountLines.AsNoTracking()
            .Where(l => l.InventoryCountId == id)
            .OrderBy(l => l.Ingredient!.Name)
            .Select(l => new InventoryCountLineDto(
                l.IngredientId,
                l.Ingredient!.Name,
                l.Ingredient.BaseUnit!.Code,
                l.ExpectedQty,
                l.CountedQty,
                l.CountedQty == null ? null : l.CountedQty - l.ExpectedQty))
            .ToListAsync(cancellationToken);
        return new InventoryCountDto(count.Id, count.Status, count.Comment, count.CreatedAt, count.CompletedAt, lines);
    }
}
