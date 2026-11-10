using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.BranchOverrides;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary><c>GET /reports/food-cost?threshold=35</c> — threshold in % (default 35, 1–100).</summary>
public sealed record FoodCostQuery
{
    public const decimal DefaultThresholdPercent = 35m;

    public decimal? Threshold { get; init; }

    public decimal SafeThreshold => Threshold ?? DefaultThresholdPercent;
}

public sealed class FoodCostQueryValidator : AbstractValidator<FoodCostQuery>
{
    public FoodCostQueryValidator() =>
        RuleFor(x => x.Threshold).InclusiveBetween(1m, 100m).When(x => x.Threshold is not null);
}

/// <summary>
/// Food cost per dish (current menu, not period-bound): active recipe cost vs the current price OF THIS BRANCH
/// (per-branch price overrides applied by <see cref="BranchMenuResolver"/>, the same prices the POS charges).
/// Items with variants get one row per non-archived variant (variant recipe, else the item recipe; variant price).
/// foodCost % = cost / price × 100; margin = price − cost. Sorted by food cost % (highest first, no-recipe rows last).
/// </summary>
public sealed class FoodCostReportHandler(
    IApplicationDbContext db, ITenantContext tenant, RecipeCostCalculator costs, BranchMenuResolver branchMenu)
    : IHandler<FoodCostQuery, FoodCostReportDto>
{
    public async Task<Result<FoodCostReportDto>> HandleAsync(FoodCostQuery request, CancellationToken cancellationToken)
    {
        var threshold = request.SafeThreshold;
        var menuItems = await db.MenuItems.AsNoTracking()
            .Include(m => m.Category)
            .Include(m => m.Variants)
            .Where(m => !m.IsArchived)
            .ToListAsync(cancellationToken);
        await branchMenu.ApplyAsync(tenant.RequireBranchId(), menuItems, cancellationToken);
        var items = menuItems.Select(m => new
        {
            m.Id,
            m.Name,
            m.Price,
            CategoryName = m.Category!.Name,
            Variants = m.Variants.Where(v => !v.IsArchived).OrderBy(v => v.Price).Select(v => new { v.Id, v.Name, v.Price }).ToList(),
        });

        var rows = new List<FoodCostItemDto>();
        foreach (var item in items)
        {
            if (item.Variants.Count == 0)
            {
                rows.Add(Row(item.Id, null, item.Name, null, item.CategoryName, item.Price,
                    await costs.FindAsync(item.Id, null, cancellationToken), threshold));
                continue;
            }

            foreach (var variant in item.Variants)
            {
                rows.Add(Row(item.Id, variant.Id, item.Name, variant.Name, item.CategoryName, variant.Price,
                    await costs.FindAsync(item.Id, variant.Id, cancellationToken), threshold));
            }
        }

        var ordered = rows
            .OrderBy(r => r.HasRecipe ? 0 : 1)
            .ThenByDescending(r => r.FoodCostPercent ?? 0m)
            .ThenBy(r => r.Name, StringComparer.CurrentCulture)
            .ToList();
        return new FoodCostReportDto(threshold, ordered.Count(r => r.IsAboveThreshold), ordered);
    }

    public static FoodCostItemDto Row(
        Guid menuItemId, Guid? variantId, string name, string? variantName, string categoryName, decimal price, RecipeCost? cost,
        decimal thresholdPercent)
    {
        var recipeCost = cost?.Cost ?? 0m;
        decimal? foodCost = cost is null || price <= 0 ? null : AnalyticsMath.Percent(recipeCost, price);
        var margin = price - recipeCost;
        decimal? marginPercent = cost is null || price <= 0 ? null : AnalyticsMath.Percent(margin, price);
        return new FoodCostItemDto(
            menuItemId, variantId, name, variantName, categoryName, price, cost is not null, cost?.HasMissingConversions ?? false,
            recipeCost, foodCost, margin, marginPercent, foodCost > thresholdPercent);
    }
}
