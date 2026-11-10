using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary><c>GET /reports/abc?from=&amp;to=&amp;metric=revenue|quantity|margin</c>.</summary>
public sealed record AbcQuery : ReportPeriodQuery
{
    public AbcMetric Metric { get; init; } = AbcMetric.Revenue;
}

public sealed class AbcQueryValidator : AbstractValidator<AbcQuery>
{
    public AbcQueryValidator()
    {
        ReportPeriodRules.Apply(this);
        RuleFor(x => x.Metric).IsInEnum();
    }
}

/// <summary>Per-item sales of the period (SQL aggregate) with current recipe cost; see <see cref="AnalyticsMath.ClassifyAbc"/>.</summary>
public sealed record SoldItemTotals(Guid MenuItemId, string Name, decimal Quantity, decimal Revenue, decimal Cost)
{
    public decimal Margin => Revenue - Cost;
}

/// <summary>
/// ABC analysis of menu items over paid orders of the period (non-cancelled lines; revenue = line totals before the
/// order-level discount, like top-items). Cost = sold quantity × current active recipe cost (variant-aware); margin = revenue − cost.
/// </summary>
public sealed class AbcReportHandler(IApplicationDbContext db, ReportScope scope, RecipeCostCalculator costs)
    : IHandler<AbcQuery, AbcReportDto>
{
    public async Task<Result<AbcReportDto>> HandleAsync(AbcQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var items = await SoldItemsAsync(db, costs, ctx, cancellationToken);
        var byId = items.ToDictionary(i => i.MenuItemId);
        var classified = AnalyticsMath.ClassifyAbc(items.Select(i => new AnalyticsMath.AbcInput(i.MenuItemId, request.Metric switch
        {
            AbcMetric.Quantity => i.Quantity,
            AbcMetric.Margin => i.Margin,
            _ => i.Revenue,
        })));
        var rows = classified.Select(c =>
        {
            var item = byId[c.Id];
            return new AbcItemDto(item.MenuItemId, item.Name, item.Quantity, item.Revenue, item.Cost, item.Margin,
                c.Value, c.SharePercent, c.CumulativePercent, c.Class);
        }).ToList();
        return new AbcReportDto(request.Metric, classified.Where(c => c.Value > 0).Sum(c => c.Value), rows);
    }

    /// <summary>Sold items of the period grouped by menu item (cost resolved per variant). Shared with the dashboard.</summary>
    public static async Task<IReadOnlyList<SoldItemTotals>> SoldItemsAsync(
        IApplicationDbContext db, RecipeCostCalculator costs, ReportContext ctx, CancellationToken ct)
    {
        var groups = await db.PaidOrders(ctx.BranchId, ctx.From, ctx.To).SoldItems()
            .GroupBy(i => new { i.MenuItemId, i.VariantId })
            .Select(g => new
            {
                g.Key.MenuItemId,
                g.Key.VariantId,
                Name = g.Max(i => i.NameSnapshot),
                Quantity = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.LineTotal),
            })
            .ToListAsync(ct);

        var totals = new Dictionary<Guid, SoldItemTotals>();
        foreach (var group in groups)
        {
            var recipe = await costs.FindAsync(group.MenuItemId, group.VariantId, ct);
            var cost = Money.Round((recipe?.Cost ?? 0m) * group.Quantity);
            totals[group.MenuItemId] = totals.TryGetValue(group.MenuItemId, out var existing)
                ? existing with { Quantity = existing.Quantity + group.Quantity, Revenue = existing.Revenue + group.Revenue, Cost = existing.Cost + cost }
                : new SoldItemTotals(group.MenuItemId, group.Name ?? string.Empty, group.Quantity, group.Revenue, cost);
        }

        return totals.Values.ToList();
    }
}
