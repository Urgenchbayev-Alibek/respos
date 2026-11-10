using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Dashboard;
using Restaurant.Application.Features.Reports.Analytics;
using Restaurant.Application.Features.Reports.CashShifts;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F5 analytics reports + owner dashboard v2 (branch-scoped, branch timezone, <c>reports.read</c>). Exports: ReportsController.</summary>
[RequireBranch]
[HasPermission(Permissions.Reports.Read)]
public sealed class AnalyticsController : ApiControllerBase
{
    [HttpGet(RoutePrefix + "dashboard/overview")]
    [ProducesResponseType<DashboardOverviewDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Overview(
        [FromQuery] DashboardOverviewQuery query, [FromServices] DashboardOverviewHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/sales-summary")]
    [ProducesResponseType<SalesSummaryDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SalesSummary(
        [FromQuery] ReportPeriodQuery query, [FromServices] SalesSummaryHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/abc")]
    [ProducesResponseType<AbcReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Abc([FromQuery] AbcQuery query, [FromServices] AbcReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/food-cost")]
    [ProducesResponseType<FoodCostReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> FoodCost([FromQuery] FoodCostQuery query, [FromServices] FoodCostReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/waiters")]
    [ProducesResponseType<IReadOnlyList<WaiterPerformanceDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Waiters(
        [FromQuery] ReportPeriodQuery query, [FromServices] WaiterPerformanceHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/heatmap")]
    [ProducesResponseType<HeatmapReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Heatmap(
        [FromQuery] ReportPeriodQuery query, [FromServices] HeatmapReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/discounts-cancellations")]
    [ProducesResponseType<DiscountsCancellationsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DiscountsCancellations(
        [FromQuery] ReportPeriodQuery query, [FromServices] DiscountsCancellationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/z-report")]
    [ProducesResponseType<ZReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ZReport([FromQuery] ZReportQuery query, [FromServices] ZReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));
}
