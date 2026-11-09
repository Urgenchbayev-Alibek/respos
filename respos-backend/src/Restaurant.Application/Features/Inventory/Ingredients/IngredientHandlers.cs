using System.Linq.Expressions;
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

namespace Restaurant.Application.Features.Inventory.Ingredients;

public sealed class ListIngredientsHandler(ITenantContext tenant, IngredientReader reader)
    : IHandler<ListIngredientsQuery, PagedResult<IngredientDto>>
{
    private static readonly Dictionary<string, Expression<Func<IngredientRow, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = r => r.Ingredient.Name,
        ["sku"] = r => r.Ingredient.Sku!,
        ["costPrice"] = r => r.Ingredient.CostPrice,
        ["quantity"] = r => r.Quantity,
        ["createdAt"] = r => r.Ingredient.CreatedAt,
    };

    public async Task<Result<PagedResult<IngredientDto>>> HandleAsync(ListIngredientsQuery request, CancellationToken cancellationToken)
    {
        var rows = reader.Rows(tenant.RequireBranchId());
        if (!request.IncludeArchived)
        {
            rows = rows.Where(r => !r.Ingredient.IsArchived);
        }

        if (request.CategoryId is { } categoryId)
        {
            rows = rows.Where(r => r.Ingredient.CategoryId == categoryId);
        }

        if (request.LowStock is { } low)
        {
            rows = low ? rows.Where(r => r.Quantity <= r.MinQuantity) : rows.Where(r => r.Quantity > r.MinQuantity);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            rows = rows.Where(r => r.Ingredient.Name.ToLower().Contains(term)
                || (r.Ingredient.Sku != null && r.Ingredient.Sku.ToLower().Contains(term)));
        }

        var sorted = rows.ApplySort(request, SortFields, r => r.Ingredient.Name);
        return await IngredientReader.Project(sorted).ToPagedResultAsync(request, cancellationToken);
    }
}

public sealed class SaveIngredientHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, IngredientReader reader, IAuditLogger audit)
    : IHandler<SaveIngredientCommand, IngredientDto>
{
    public async Task<Result<IngredientDto>> HandleAsync(SaveIngredientCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        if (!await db.Units.AnyAsync(u => u.Id == request.BaseUnitId, cancellationToken))
        {
            return InventoryErrors.UnitNotFound;
        }

        if (request.CategoryId is { } categoryId && !await db.IngredientCategories.AnyAsync(c => c.Id == categoryId, cancellationToken))
        {
            return InventoryErrors.CategoryNotFound;
        }

        Ingredient? ingredient;
        if (request.Id is { } id)
        {
            ingredient = await db.Ingredients.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
            if (ingredient is null)
            {
                return InventoryErrors.IngredientNotFound;
            }

            if (ingredient.BaseUnitId != request.BaseUnitId
                && await db.StockMovements.IgnoreQueryFilters().AnyAsync(m => m.IngredientId == ingredient.Id, cancellationToken))
            {
                return InventoryErrors.BaseUnitLocked;
            }
        }
        else
        {
            ingredient = new Ingredient { OrganizationId = orgId };
            db.Ingredients.Add(ingredient);
        }

        ingredient.Name = request.Name.Trim();
        ingredient.Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim();
        ingredient.CategoryId = request.CategoryId;
        ingredient.BaseUnitId = request.BaseUnitId;
        ingredient.CostPrice = request.CostPrice;
        if (request.MinQuantity is { } min)
        {
            (await ledger.GetOrCreateBalanceAsync(orgId, branchId, ingredient.Id, cancellationToken)).MinQuantity = min;
        }

        audit.Log(request.Id is null ? "ingredient.created" : "ingredient.updated", nameof(Ingredient), ingredient.Id,
            new { ingredient.Name, ingredient.Sku, ingredient.CategoryId, ingredient.BaseUnitId, ingredient.CostPrice });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, ingredient.Id, cancellationToken))!;
    }
}

public sealed class ArchiveIngredientHandler(IApplicationDbContext db, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveIngredientCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveIngredientCommand request, CancellationToken cancellationToken)
    {
        var ingredient = await db.Ingredients.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        if (ingredient is null)
        {
            return InventoryErrors.IngredientNotFound;
        }

        ingredient.Archive(clock.UtcNow);
        audit.Log("ingredient.archived", nameof(Ingredient), ingredient.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

/// <summary><c>PUT /ingredients/{id}/min-quantity</c> — per-branch minimum on the (lazily created) balance.</summary>
public sealed class SetMinQuantityHandler(
    IApplicationDbContext db, ITenantContext tenant, StockLedger ledger, IngredientReader reader, IAuditLogger audit)
    : IHandler<SetMinQuantityCommand, IngredientDto>
{
    public async Task<Result<IngredientDto>> HandleAsync(SetMinQuantityCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        if (!await db.Ingredients.AnyAsync(i => i.Id == request.IngredientId, cancellationToken))
        {
            return InventoryErrors.IngredientNotFound;
        }

        var balance = await ledger.GetOrCreateBalanceAsync(orgId, branchId, request.IngredientId, cancellationToken);
        balance.MinQuantity = request.MinQuantity;
        audit.Log("ingredient.min_quantity_changed", nameof(Ingredient), request.IngredientId, new { request.MinQuantity });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, request.IngredientId, cancellationToken))!;
    }
}
