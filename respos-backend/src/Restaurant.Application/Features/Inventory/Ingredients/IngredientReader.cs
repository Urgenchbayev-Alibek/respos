using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Entities.Inventory;

namespace Restaurant.Application.Features.Inventory.Ingredients;

/// <summary>Ingredient joined with its balance in one branch (missing balance = 0 / min 0).</summary>
public sealed class IngredientRow
{
    public Ingredient Ingredient { get; init; } = null!;
    public decimal Quantity { get; init; }
    public decimal MinQuantity { get; init; }
}

[ScopedService]
public sealed class IngredientReader(IApplicationDbContext db)
{
    public IQueryable<IngredientRow> Rows(Guid branchId) =>
        from i in db.Ingredients.AsNoTracking()
        join b in db.StockBalances.Where(b => b.BranchId == branchId) on i.Id equals b.IngredientId into balances
        from b in balances.DefaultIfEmpty()
        select new IngredientRow
        {
            Ingredient = i,
            Quantity = b == null ? 0m : b.Quantity,
            MinQuantity = b == null ? 0m : b.MinQuantity,
        };

    public static IQueryable<IngredientDto> Project(IQueryable<IngredientRow> rows) =>
        rows.Select(r => new IngredientDto(
            r.Ingredient.Id,
            r.Ingredient.Name,
            r.Ingredient.Sku,
            r.Ingredient.CategoryId,
            r.Ingredient.Category == null ? null : r.Ingredient.Category.Name,
            r.Ingredient.BaseUnitId,
            r.Ingredient.BaseUnit!.Code,
            r.Ingredient.CostPrice,
            r.Quantity,
            r.MinQuantity,
            r.Quantity <= r.MinQuantity,
            r.Ingredient.IsArchived,
            r.Ingredient.DefaultSupplierId,
            r.Ingredient.DefaultSupplier == null ? null : r.Ingredient.DefaultSupplier.Name));

    public async Task<IngredientDto?> GetAsync(Guid branchId, Guid ingredientId, CancellationToken cancellationToken) =>
        await Project(Rows(branchId).Where(r => r.Ingredient.Id == ingredientId)).FirstOrDefaultAsync(cancellationToken);
}
