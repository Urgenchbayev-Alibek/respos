using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Analytics;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Dashboard;

/// <summary><c>GET /dashboard/overview?period=today|7d|30d</c> (default today).</summary>
public sealed record DashboardOverviewQuery
{
    public static readonly IReadOnlyList<string> Periods = ["today", "7d", "30d"];

    public string? Period { get; init; }

    public string SafePeriod => Period is { } p && Periods.Contains(p) ? p : "today";
}

public sealed class DashboardOverviewQueryValidator : AbstractValidator<DashboardOverviewQuery>
{
    public DashboardOverviewQueryValidator() =>
        RuleFor(x => x.Period).Must(p => p is null || DashboardOverviewQuery.Periods.Contains(p))
            .WithErrorCode("report.invalid_period").WithMessage("period must be one of: today, 7d, 30d.");
}

/// <summary>One sparkline point: a local day, or a local hour of <c>date</c> when the period is <c>today</c>.</summary>
public sealed record SparkPointDto(DateOnly Date, int? Hour, decimal Revenue, int Orders);

public sealed record DashboardDishDto(Guid MenuItemId, string Name, decimal Quantity, decimal Revenue, decimal Margin);

public sealed record DashboardOverviewDto(
    string Period,
    DateOnly From,
    DateOnly To,
    DateOnly PreviousFrom,
    DateOnly PreviousTo,
    SalesTotalsDto Current,
    SalesTotalsDto Previous,
    SalesDeltasDto Deltas,
    IReadOnlyList<SparkPointDto> Sparkline,
    IReadOnlyList<DashboardDishDto> TopItems,
    IReadOnlyList<DashboardDishDto> BottomItems,
    FoodCostReportDto FoodCostAlerts,
    bool IsDemoData);

/// <summary>
/// Owner dashboard v2: KPIs of the period vs the previous equal period (Δ %), sparkline (hourly for today, daily otherwise),
/// top/bottom 5 dishes by revenue (bottom excludes the top ones), and the dishes above the food-cost threshold (max 5).
/// </summary>
public sealed class DashboardOverviewHandler(
    IApplicationDbContext db, ITenantContext tenant, ReportScope scope, RecipeCostCalculator costs, FoodCostReportHandler foodCost)
    : IHandler<DashboardOverviewQuery, DashboardOverviewDto>
{
    public const int DishesLimit = 5;

    public async Task<Result<DashboardOverviewDto>> HandleAsync(DashboardOverviewQuery request, CancellationToken cancellationToken)
    {
        var organizationId = tenant.RequireOrganizationId();
        var today = (await scope.ResolveAsync(null, cancellationToken)).Today;
        var period = request.SafePeriod;
        var days = period switch { "7d" => 7, "30d" => 30, _ => 1 };
        var ctx = await scope.ResolveAsync(new ReportPeriodQuery { From = today.AddDays(1 - days), To = today }, cancellationToken);

        var summary = await SalesSummaryHandler.BuildAsync(db, ctx.BranchId, ctx.From, ctx.To, cancellationToken);
        var sparkline = days == 1 ? await HourlyAsync(ctx, cancellationToken) : summary.ByDay.Select(d => new SparkPointDto(d.Date, null, d.Revenue, d.Orders)).ToList();

        var sold = await AbcReportHandler.SoldItemsAsync(db, costs, ctx, cancellationToken);
        var top = sold.OrderByDescending(i => i.Revenue).ThenBy(i => i.Name, StringComparer.CurrentCulture).Take(DishesLimit).ToList();
        var bottom = sold.Except(top).OrderBy(i => i.Revenue).ThenBy(i => i.Name, StringComparer.CurrentCulture).Take(DishesLimit).ToList();

        var food = await foodCost.HandleAsync(new FoodCostQuery(), cancellationToken);
        var alerts = food.Value with { Items = food.Value.Items.Where(i => i.IsAboveThreshold).Take(DishesLimit).ToList() };
        var isDemo = await db.Organizations.Where(o => o.Id == organizationId).Select(o => o.IsDemo).FirstOrDefaultAsync(cancellationToken);

        return new DashboardOverviewDto(
            period, summary.From, summary.To, summary.PreviousFrom, summary.PreviousTo, summary.Current, summary.Previous, summary.Deltas,
            sparkline, top.Select(Dish).ToList(), bottom.Select(Dish).ToList(), alerts, isDemo);
    }

    private static DashboardDishDto Dish(SoldItemTotals item) => new(item.MenuItemId, item.Name, item.Quantity, item.Revenue, item.Margin);

    private async Task<IReadOnlyList<SparkPointDto>> HourlyAsync(ReportContext ctx, CancellationToken ct)
    {
        var hours = (await db.SalesByLocalHourAsync(ctx, ct))
            .Where(h => DateOnly.FromDateTime(h.LocalHour) == ctx.From)
            .ToDictionary(h => h.LocalHour.Hour);
        return Enumerable.Range(0, 24)
            .Select(hour => hours.TryGetValue(hour, out var h)
                ? new SparkPointDto(ctx.From, hour, h.Revenue, h.Orders)
                : new SparkPointDto(ctx.From, hour, 0m, 0))
            .ToList();
    }
}
